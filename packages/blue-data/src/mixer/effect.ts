/**
 * Effect — a mixer effect with BSB-like code compilation.
 * Mirrors the Java Effect class.
 *
 * Effects have code with `<objectName>` placeholders (like BSB instruments),
 * a graphic interface with widgets, and a parameterList.
 * During CSD generation, effects produce UDOs (blueEffectN).
 */
import { Element } from '../serialization/xml-reader';
import { BlueDataObject } from '../blue-data-object';
import { Parameter, AutomationCurve } from '../automation/parameter';
import { BSBGraphicInterface } from '../instruments/blue-synth-builder/bsb-graphic-interface';
import { BSBCompilationUnit } from '../instruments/blue-synth-builder/bsb-compilation-unit';
import { OpcodeDefinition } from '../opcodes/opcode-definition';
import { OpcodeList } from '../opcodes/opcode-list';
import { UDOStyle } from '../opcodes/udo-style';
import { appendUserDefinedOpcodes } from '../opcodes/udo-utilities';
import { replaceOpcodeNames } from '../utilities/text';

export class Effect implements BlueDataObject {
  private _name = 'New Effect';
  private _enabled = true;
  private _numIns = 2;
  private _numOuts = 2;
  private _code = '';
  private _style: UDOStyle = UDOStyle.MODERN;
  private _graphicInterface = new BSBGraphicInterface();
  private _parameters: Parameter[] = [];
  private _opcodeList = new OpcodeList();
  private _comments = '';

  getName(): string {
    return this._name;
  }
  setName(name: string): void {
    this._name = name;
  }

  isEnabled(): boolean {
    return this._enabled;
  }
  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  getNumIns(): number {
    return this._numIns;
  }
  setNumIns(n: number): void {
    this._numIns = n;
  }

  getNumOuts(): number {
    return this._numOuts;
  }
  setNumOuts(n: number): void {
    this._numOuts = n;
  }

  getCode(): string {
    return this._code;
  }
  setCode(code: string): void {
    this._code = code;
  }

  getComments(): string {
    return this._comments;
  }
  setComments(comments: string): void {
    this._comments = comments;
  }

  getStyle(): UDOStyle {
    return this._style;
  }
  setStyle(style: UDOStyle): void {
    this._style = style;
  }

  getGraphicInterface(): BSBGraphicInterface {
    return this._graphicInterface;
  }

  getParameters(): Parameter[] {
    return [...this._parameters];
  }

  getOpcodeList(): OpcodeList {
    return this._opcodeList;
  }

  /**
   * Generate a UDO from this effect's code.
   * Returns the UDO as a CSD string, using classic or modern style.
   */
  generateUDO(effectId: number, parameters?: Parameter[], udoList?: OpcodeList): string {
    if (!this._code) return '';

    const replacementParameters = parameters ?? this._parameters;
    const udoReplacementValues = udoList
      ? appendUserDefinedOpcodes(this._opcodeList, udoList)
      : null;

    // Compile BSB widget replacements
    const unit = new BSBCompilationUnit();
    this._graphicInterface.collectReplacements(unit, replacementParameters);
    let compiledCode = unit.replaceBSBValues(this._code);

    // If GI didn't load (async), fall back to parameter-based replacement
    if (compiledCode.includes('<')) {
      compiledCode = this.compileWithParameters(compiledCode, replacementParameters);
    }

    if (udoReplacementValues && udoReplacementValues.size > 0) {
      compiledCode = replaceOpcodeNames(udoReplacementValues, compiledCode);
    }

    const udo = new OpcodeDefinition();
    udo.setName(`blueEffect${effectId}`);
    udo.setCommentText(this._name);
    udo.setStyle(this._style);

    const inArgs = [];
    for (let i = 0; i < this._numIns; i++) inArgs.push(`ain${i + 1}`);
    const outArgs = [];
    for (let i = 0; i < this._numOuts; i++) outArgs.push(`aout${i + 1}`);

    if (this._style === UDOStyle.CLASSIC) {
      const inTypes = this._getSigTypes(this._numIns);
      const outTypes = this._getSigTypes(this._numOuts);
      udo.setInTypes(inTypes);
      udo.setOutTypes(outTypes);
      udo.setInputArguments('');
      udo.setCode(`${inArgs.join(',')}\txin\n\n${compiledCode}\n\nxout\t${outArgs.join(',')}\n\n`);
    } else {
      // Modern style
      const outTypes = this._getCommaSeparatedSigTypes(this._numOuts);
      udo.setInputArguments(inArgs.join(', '));
      udo.setOutTypes(outTypes);
      udo.setInTypes('');
      udo.setCode([compiledCode, '', '', `xout\t${outArgs.join(',')}`, ''].join('\n'));
    }

    return udo.generateCode();
  }

  private _getSigTypes(num: number): string {
    return 'a'.repeat(num);
  }

  private _getCommaSeparatedSigTypes(num: number): string {
    if (num === 0) return '';
    const parts: string[] = [];
    for (let i = 0; i < num; i++) parts.push('a');
    return parts.join(', ');
  }

  /**
   * Compile effect code using its own parameter list as fallback.
   * Replaces `<paramName>` tokens with parameter values or compilation variable names.
   */
  private compileWithParameters(code: string, externalParams?: Parameter[]): string {
    let result = code;

    // First try external parameters (for compilation variable names)
    if (externalParams) {
      for (const param of externalParams) {
        const name = param.getName();
        const varName = param.getCompilationVarName();
        if (name && varName) {
          result = result.replaceAll(`<${name}>`, varName);
        }
      }
    }

    // Fall back to this effect's own parameters for remaining tokens
    for (const param of this._parameters) {
      const name = param.getName();
      const varName = param.getCompilationVarName();
      if (name && varName) {
        result = result.replaceAll(`<${name}>`, varName);
      } else if (name) {
        result = result.replaceAll(`<${name}>`, param.getFixedValue().toString());
      }
    }

    return result;
  }

  saveAsXML(): Element {
    const elem = new Element('effect');
    elem.addElement('style').setText(this._style);
    elem.addElement('name').setText(this._name);
    elem.addElement('enabled').setText(this._enabled.toString());
    elem.addElement('numIns').setText(this._numIns.toString());
    elem.addElement('numOuts').setText(this._numOuts.toString());
    if (this._code) elem.addElement('code').setText(this._code);
    elem.addElement('comments').setText(this._comments);
    elem.addElement(this._opcodeList.saveAsXML());
    elem.addElement(this._graphicInterface.saveAsXML());

    const parameterList = new Element('parameterList');
    for (const parameter of this._parameters) {
      parameterList.addElement(parameter.saveAsXML());
    }
    elem.addElement(parameterList);

    return elem;
  }

  static loadFromXML(data: Element): Effect {
    const effect = new Effect();
    // Default to CLASSIC for legacy files without <style>
    effect._style = UDOStyle.CLASSIC;

    const name = data.getTextString('name');
    if (name) effect._name = name;

    const style = data.getTextString('style');
    if (style) {
      try {
        effect._style = UDOStyle[style as keyof typeof UDOStyle];
      } catch {
        effect._style = UDOStyle.CLASSIC;
      }
    }

    const enabled = data.getTextString('enabled');
    if (enabled !== null) effect._enabled = enabled !== 'false';

    const numIns = data.getTextString('numIns');
    if (numIns) effect._numIns = parseInt(numIns, 10);

    const numOuts = data.getTextString('numOuts');
    if (numOuts) effect._numOuts = parseInt(numOuts, 10);

    const code = data.getTextString('code');
    if (code) effect._code = code;

    const comments = data.getTextString('comments');
    if (comments) effect._comments = comments;

    const opcodeListElem = data.getElement('opcodeList');
    if (opcodeListElem) {
      effect._opcodeList = OpcodeList.loadFromXML(opcodeListElem);
    }

    // Load graphic interface (BSB widgets for parameter knobs)
    const giElem = data.getElement('graphicInterface');
    if (giElem) {
      effect._graphicInterface.loadFromXML(giElem);
    }

    // Load parameter list
    const paramListElem = data.getElement('parameterList') || data.getElement('bsbParameterList');
    if (paramListElem) {
      effect._parameters = Effect._loadParameters(paramListElem);
    }

    if (!effect._opcodeList) {
      effect._opcodeList = new OpcodeList();
    }

    if (!effect._graphicInterface) {
      effect._graphicInterface = new BSBGraphicInterface();
    }

    return effect;
  }

  /**
   * Load parameters from <parameterList> XML.
   */
  private static _loadParameters(data: Element): Parameter[] {
    const parameters: Parameter[] = [];
    const paramElems = data.getElements('parameter');

    while (paramElems.hasMoreElements()) {
      parameters.push(Parameter.loadFromXML(paramElems.next()));
    }

    return parameters;
  }

  deepCopy(): BlueDataObject {
    const copy = new Effect();
    copy._name = this._name;
    copy._enabled = this._enabled;
    copy._numIns = this._numIns;
    copy._numOuts = this._numOuts;
    copy._code = this._code;
    copy._style = this._style;
    copy._comments = this._comments;
    copy._graphicInterface = new BSBGraphicInterface();
    copy._graphicInterface.loadFromXML(this._graphicInterface.saveAsXML());
    copy._parameters = this._parameters.map((param) => param.deepCopy() as Parameter);
    copy._opcodeList = OpcodeList.loadFromXML(this._opcodeList.saveAsXML());
    return copy;
  }
}
