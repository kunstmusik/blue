import { definePlugin, defineRule } from 'vite-plus/lint/plugins';

const DIALOG_GLOBALS = new Set(['confirm', 'prompt', 'alert']);
const DIALOG_GLOBAL_MESSAGES = {
  confirm:
    'Use window.blueAPI.showNativeConfirmation or ConfirmationDialog instead of window.confirm / confirm.',
  prompt: 'Use an in-app text prompt dialog instead of window.prompt / prompt.',
  alert: 'Use toast notifications or ConfirmationDialog instead of window.alert / alert.',
};

const MESSAGE_BOX_METHODS = new Set(['showMessageBox', 'showMessageBoxSync']);

function staticPropertyName(key, computed) {
  if (key.type === 'Identifier' && !computed) return key.name;
  if (key.type === 'Literal') return key.value;
  if (key.type === 'TemplateLiteral' && key.expressions.length === 0) {
    return key.quasis[0].value.cooked;
  }
}

function calledMemberName(node) {
  return node.property.type === 'Identifier'
    ? node.property.name
    : staticPropertyName(node.property, node.computed);
}

function destructuredProperties(report) {
  return (node) => {
    const source = node.parent.type === 'VariableDeclarator' ? node.parent.init : node.parent.right;
    if (source?.type !== 'Identifier') return;
    for (const property of node.properties) {
      if (property.type === 'Property') {
        report(property, source.name, staticPropertyName(property.key, property.computed));
      }
    }
  };
}

function containsJoinCall(node) {
  if (!node || typeof node !== 'object') {
    return false;
  }
  if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    calledMemberName(node.callee) === 'join'
  ) {
    return true;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') {
      continue;
    }
    if (Array.isArray(value)) {
      if (value.some((item) => containsJoinCall(item))) {
        return true;
      }
    } else if (value && typeof value === 'object' && typeof value.type === 'string') {
      if (containsJoinCall(value)) {
        return true;
      }
    }
  }
  return false;
}

const noBrowserDialogs = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow browser dialog properties on window and globalThis.',
    },
    messages: {
      restrictedProperty: '{{message}}',
    },
  },
  create(context) {
    function report(node, object, property) {
      if ((object === 'window' || object === 'globalThis') && DIALOG_GLOBALS.has(property)) {
        context.report({
          node,
          messageId: 'restrictedProperty',
          data: { message: DIALOG_GLOBAL_MESSAGES[property] },
        });
      }
    }

    return {
      MemberExpression(node) {
        if (node.object.type === 'Identifier') {
          report(node, node.object.name, staticPropertyName(node.property, node.computed));
        }
      },
      ObjectPattern: destructuredProperties(report),
    };
  },
});

const noDirectShowMessageBox = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow direct Electron showMessageBox/showMessageBoxSync usage.',
    },
    messages: {
      directCall:
        'Use showNativeConfirmation from packages/blue-app/src/main/native-confirmation.ts instead of {{method}} directly.',
    },
  },
  create(context) {
    function report(node, method) {
      context.report({ node, messageId: 'directCall', data: { method } });
    }

    return {
      MemberExpression(node) {
        const property = staticPropertyName(node.property, node.computed);
        if (
          node.object.type === 'Identifier' &&
          node.object.name === 'dialog' &&
          MESSAGE_BOX_METHODS.has(property)
        ) {
          report(node, `dialog.${property}`);
          return;
        }

        if (node.parent?.type === 'CallExpression' && node.parent.callee === node) {
          const method = calledMemberName(node);
          if (MESSAGE_BOX_METHODS.has(method)) report(node, method);
        }
      },
      ObjectPattern: destructuredProperties((node, object, method) => {
        if (object === 'dialog' && MESSAGE_BOX_METHODS.has(method)) {
          report(node, `dialog.${method}`);
        }
      }),
    };
  },
});

const noClassnameStringConcat = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Require cn() instead of template literals or array join in JSX className.',
    },
    messages: {
      templateLiteral:
        'Use cn() from src/renderer/lib/cn.ts instead of template literals for className.',
      arrayJoin: 'Use cn() from src/renderer/lib/cn.ts instead of array join for className.',
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (
          node.name?.type !== 'JSXIdentifier' ||
          node.name.name !== 'className' ||
          node.value?.type !== 'JSXExpressionContainer'
        ) {
          return;
        }
        const expr = node.value.expression;
        if (expr?.type === 'TemplateLiteral') {
          context.report({ node: expr, messageId: 'templateLiteral' });
        } else if (containsJoinCall(expr)) {
          context.report({ node: expr, messageId: 'arrayJoin' });
        }
      },
    };
  },
});

export default definePlugin({
  meta: { name: 'blue' },
  rules: {
    'no-browser-dialogs': noBrowserDialogs,
    'no-direct-show-message-box': noDirectShowMessageBox,
    'no-classname-string-concat': noClassnameStringConcat,
  },
});
