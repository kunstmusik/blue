import { definePlugin, defineRule } from 'vite-plus/lint/plugins';

const DIALOG_GLOBALS = new Set(['confirm', 'prompt', 'alert']);
const DIALOG_GLOBAL_MESSAGES = {
  confirm:
    'Use window.blueAPI.showNativeConfirmation or ConfirmationDialog instead of window.confirm / confirm.',
  prompt: 'Use an in-app text prompt dialog instead of window.prompt / prompt.',
  alert: 'Use toast notifications or ConfirmationDialog instead of window.alert / alert.',
};

const MESSAGE_BOX_METHODS = new Set(['showMessageBox', 'showMessageBoxSync']);

function containsJoinCall(node) {
  if (!node || typeof node !== 'object') {
    return false;
  }
  if (
    node.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.property?.type === 'Identifier' &&
    node.callee.property.name === 'join'
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
    return {
      MemberExpression(node) {
        if (
          node.computed ||
          node.object?.type !== 'Identifier' ||
          (node.object.name !== 'window' && node.object.name !== 'globalThis') ||
          node.property?.type !== 'Identifier' ||
          !DIALOG_GLOBALS.has(node.property.name)
        ) {
          return;
        }
        context.report({
          node,
          messageId: 'restrictedProperty',
          data: {
            message: DIALOG_GLOBAL_MESSAGES[node.property.name],
          },
        });
      },
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
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee?.type !== 'MemberExpression' ||
          callee.computed ||
          callee.property?.type !== 'Identifier' ||
          !MESSAGE_BOX_METHODS.has(callee.property.name)
        ) {
          return;
        }
        context.report({
          node,
          messageId: 'directCall',
          data: {
            method:
              callee.object?.type === 'Identifier' && callee.object.name === 'dialog'
                ? `dialog.${callee.property.name}`
                : `calling ${callee.property.name}`,
          },
        });
      },
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
