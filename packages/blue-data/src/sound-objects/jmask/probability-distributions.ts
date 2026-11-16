import { Element } from '../../serialization/xml-reader';
import { XmlLoadContext } from '../../serialization/xml-load';
import {
  writeBoolean,
  writeDouble,
  writeInt,
  readBoolean,
  readDouble,
  readInt,
} from '../../utilities/xml';
import { validateJmaskXml } from './xml-policy';
import { JavaRandom, ProbabilityGenerator, Table } from './core-table-modifiers';

export class Uniform implements ProbabilityGenerator {
  constructor(other?: Uniform) {
    void other;
  }

  static loadFromXML(_data: Element, context = new XmlLoadContext(_data)): Uniform {
    validateJmaskXml(_data, 'Uniform', context);
    return new Uniform();
  }

  getName(): string {
    return 'Uniform';
  }

  initialize(_duration: number): void {}

  getValue(_time: number, rnd: JavaRandom): number {
    return rnd.nextDouble();
  }

  saveAsXML(): Element {
    const retVal = new Element('probabilityGenerator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.probability.Uniform');
    return retVal;
  }

  deepCopy(): Uniform {
    return new Uniform(this);
  }
}

export class Triangle implements ProbabilityGenerator {
  constructor(other?: Triangle) {
    void other;
  }

  static loadFromXML(_data: Element, context = new XmlLoadContext(_data)): Triangle {
    validateJmaskXml(_data, 'Triangle', context);
    return new Triangle();
  }

  getName(): string {
    return 'Triangle';
  }

  initialize(_duration: number): void {}

  getValue(_time: number, rnd: JavaRandom): number {
    return 0.5 * (rnd.nextDouble() + rnd.nextDouble());
  }

  saveAsXML(): Element {
    const retVal = new Element('probabilityGenerator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.probability.Triangle');
    return retVal;
  }

  deepCopy(): Triangle {
    return new Triangle(this);
  }
}

export class Linear implements ProbabilityGenerator {
  static readonly DECREASING = 0;
  static readonly INCREASING = 1;

  direction = Linear.DECREASING;

  constructor(other?: Linear) {
    if (other) {
      this.direction = other.direction;
    }
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Linear {
    validateJmaskXml(data, 'Linear', context);
    const linear = new Linear();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      if (node.getName() === 'direction') {
        linear.direction = readInt(node);
      }
    }
    return linear;
  }

  getName(): string {
    return 'Linear';
  }

  initialize(_duration: number): void {}

  getValue(_time: number, rnd: JavaRandom): number {
    const x1 = rnd.nextDouble();
    const x2 = rnd.nextDouble();
    return this.direction === Linear.DECREASING ? Math.min(x1, x2) : Math.max(x1, x2);
  }

  saveAsXML(): Element {
    const retVal = new Element('probabilityGenerator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.probability.Linear');
    retVal.addElement(writeInt('direction', this.direction));
    return retVal;
  }

  deepCopy(): Linear {
    return new Linear(this);
  }
}

export class Exponential implements ProbabilityGenerator {
  static readonly DECREASING = 0;
  static readonly INCREASING = 1;
  static readonly BILATERAL = 2;

  direction = Exponential.DECREASING;
  lambda = 0.5;
  lambdaTable = new Table();
  lambdaTableEnabled = false;

  constructor(other?: Exponential) {
    if (other) {
      this.direction = other.direction;
      this.lambda = other.lambda;
      this.lambdaTable = new Table(other.lambdaTable);
      this.lambdaTableEnabled = other.lambdaTableEnabled;
      return;
    }

    this.lambdaTable.setMin(0.0001, false);
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Exponential {
    validateJmaskXml(data, 'Exponential', context);
    const exponential = new Exponential();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'direction':
          exponential.direction = readInt(node);
          break;
        case 'lambda':
          exponential.lambda = readDouble(node);
          break;
        case 'lambdaTableEnabled':
          exponential.lambdaTableEnabled = readBoolean(node);
          break;
        case 'table':
          exponential.lambdaTable = Table.loadFromXML(node);
          break;
      }
    }
    return exponential;
  }

  getName(): string {
    return 'Exponential';
  }

  initialize(_duration: number): void {}

  getValue(time: number, rnd: JavaRandom): number {
    const localLambda = this.lambdaTableEnabled ? this.lambdaTable.getValue(time) : this.lambda;
    let x = 0.0;

    if (this.direction === Exponential.BILATERAL) {
      let e = 0.0;
      do {
        x = 2.0 * rnd.nextDouble();
        if (x > 1.0) {
          x = 2.0 - x;
          e = -Math.log(x);
        } else {
          e = Math.log(x);
        }
        e = e / 14.0 / localLambda + 0.5;
      } while (e > 1.0 || e < 0.0);
      return e;
    }

    do {
      while ((x = rnd.nextDouble()) === 0) {
        // retry
      }
      x = -Math.log(x) / 7.0 / localLambda;
    } while (x > 1.0);

    if (this.direction === Exponential.INCREASING) {
      x = 1.0 - x;
    }
    return x;
  }

  saveAsXML(): Element {
    const retVal = new Element('probabilityGenerator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.probability.Exponential');
    retVal.addElement(writeInt('direction', this.direction));
    retVal.addElement(writeDouble('lambda', this.lambda));
    retVal.addElement(writeBoolean('lambdaTableEnabled', this.lambdaTableEnabled));
    retVal.addElement(this.lambdaTable.saveAsXML());
    return retVal;
  }

  deepCopy(): Exponential {
    return new Exponential(this);
  }
}

export class Gaussian implements ProbabilityGenerator {
  sigma = 0.1;
  mu = 0.5;
  sigmaTableEnabled = false;
  muTableEnabled = false;
  sigmaTable = new Table();
  muTable = new Table();

  constructor(other?: Gaussian) {
    if (other) {
      this.sigma = other.sigma;
      this.mu = other.mu;
      this.sigmaTableEnabled = other.sigmaTableEnabled;
      this.muTableEnabled = other.muTableEnabled;
      this.sigmaTable = new Table(other.sigmaTable);
      this.muTable = new Table(other.muTable);
      return;
    }

    this.sigmaTable.getPoint(0).setValue(0.1);
    this.sigmaTable.getPoint(1).setValue(0.1);
    this.muTable.getPoint(0).setValue(0.5);
    this.muTable.getPoint(1).setValue(0.5);
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Gaussian {
    validateJmaskXml(data, 'Gaussian', context);
    const gaussian = new Gaussian();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'sigma':
          gaussian.sigma = readDouble(node);
          break;
        case 'mu':
          gaussian.mu = readDouble(node);
          break;
        case 'sigmaTableEnabled':
          gaussian.sigmaTableEnabled = readBoolean(node);
          break;
        case 'muTableEnabled':
          gaussian.muTableEnabled = readBoolean(node);
          break;
        case 'table': {
          const tableId = node.getAttributeValue('tableId');
          if (tableId === 'sigmaTable') {
            gaussian.sigmaTable = Table.loadFromXML(node);
          } else if (tableId === 'muTable') {
            gaussian.muTable = Table.loadFromXML(node);
          }
          break;
        }
      }
    }
    return gaussian;
  }

  getName(): string {
    return 'Gaussian';
  }

  initialize(_duration: number): void {}

  getValue(time: number, rnd: JavaRandom): number {
    const localSigma = this.sigmaTableEnabled ? this.sigmaTable.getValue(time) : this.sigma;
    const localMu = this.muTableEnabled ? this.muTable.getValue(time) : this.mu;

    let value = 0.0;
    do {
      let sum = 0.0;
      for (let index = 1; index <= 12; index += 1) {
        sum += rnd.nextDouble();
      }
      value = localSigma * (sum - 6.0) + localMu;
    } while (value > 1.0 || value < 0.0);

    return value;
  }

  saveAsXML(): Element {
    const retVal = new Element('probabilityGenerator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.probability.Gaussian');
    retVal.addElement(writeDouble('sigma', this.sigma));
    retVal.addElement(writeDouble('mu', this.mu));
    retVal.addElement(writeBoolean('sigmaTableEnabled', this.sigmaTableEnabled));
    retVal.addElement(writeBoolean('muTableEnabled', this.muTableEnabled));

    const sigmaTableNode = this.sigmaTable.saveAsXML();
    sigmaTableNode.setAttribute('tableId', 'sigmaTable');
    retVal.addElement(sigmaTableNode);

    const muTableNode = this.muTable.saveAsXML();
    muTableNode.setAttribute('tableId', 'muTable');
    retVal.addElement(muTableNode);
    return retVal;
  }

  deepCopy(): Gaussian {
    return new Gaussian(this);
  }
}

export class Cauchy implements ProbabilityGenerator {
  alpha = 0.1;
  mu = 0.5;
  alphaTableEnabled = false;
  muTableEnabled = false;
  alphaTable = new Table();
  muTable = new Table();

  constructor(other?: Cauchy) {
    if (other) {
      this.alpha = other.alpha;
      this.mu = other.mu;
      this.alphaTableEnabled = other.alphaTableEnabled;
      this.muTableEnabled = other.muTableEnabled;
      this.alphaTable = new Table(other.alphaTable);
      this.muTable = new Table(other.muTable);
      return;
    }

    this.alphaTable.getPoint(0).setValue(0.1);
    this.alphaTable.getPoint(1).setValue(0.1);
    this.muTable.getPoint(0).setValue(0.5);
    this.muTable.getPoint(1).setValue(0.5);
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Cauchy {
    validateJmaskXml(data, 'Cauchy', context);
    const cauchy = new Cauchy();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'alpha':
          cauchy.alpha = readDouble(node);
          break;
        case 'mu':
          cauchy.mu = readDouble(node);
          break;
        case 'alphaTableEnabled':
          cauchy.alphaTableEnabled = readBoolean(node);
          break;
        case 'muTableEnabled':
          cauchy.muTableEnabled = readBoolean(node);
          break;
        case 'table': {
          const tableId = node.getAttributeValue('tableId');
          if (tableId === 'alphaTable') {
            cauchy.alphaTable = Table.loadFromXML(node);
          } else if (tableId === 'muTable') {
            cauchy.muTable = Table.loadFromXML(node);
          }
          break;
        }
      }
    }
    return cauchy;
  }

  getName(): string {
    return 'Cauchy';
  }

  initialize(_duration: number): void {}

  getValue(time: number, rnd: JavaRandom): number {
    const localAlpha = this.alphaTableEnabled ? this.alphaTable.getValue(time) : this.alpha;
    const localMu = this.muTableEnabled ? this.muTable.getValue(time) : this.mu;

    let x = 0.0;
    let e = 0.0;
    do {
      do {
        x = rnd.nextDouble();
      } while (x === 0.5);
      e = localAlpha * Math.tan(x * Math.PI) + localMu;
    } while (e > 1.0 || e < 0.0);

    return e;
  }

  saveAsXML(): Element {
    const retVal = new Element('probabilityGenerator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.probability.Cauchy');
    retVal.addElement(writeDouble('alpha', this.alpha));
    retVal.addElement(writeDouble('mu', this.mu));
    retVal.addElement(writeBoolean('alphaTableEnabled', this.alphaTableEnabled));
    retVal.addElement(writeBoolean('muTableEnabled', this.muTableEnabled));

    const alphaTableNode = this.alphaTable.saveAsXML();
    alphaTableNode.setAttribute('tableId', 'alphaTable');
    retVal.addElement(alphaTableNode);

    const muTableNode = this.muTable.saveAsXML();
    muTableNode.setAttribute('tableId', 'muTable');
    retVal.addElement(muTableNode);
    return retVal;
  }

  deepCopy(): Cauchy {
    return new Cauchy(this);
  }
}

export class Beta implements ProbabilityGenerator {
  a = 0.1;
  b = 0.1;
  aTable = new Table();
  bTable = new Table();
  aTableEnabled = false;
  bTableEnabled = false;

  constructor(other?: Beta) {
    if (other) {
      this.a = other.a;
      this.b = other.b;
      this.aTable = new Table(other.aTable);
      this.bTable = new Table(other.bTable);
      this.aTableEnabled = other.aTableEnabled;
      this.bTableEnabled = other.bTableEnabled;
      return;
    }

    this.aTable.getPoint(0).setValue(0.1);
    this.aTable.getPoint(1).setValue(0.1);
    this.bTable.getPoint(0).setValue(0.1);
    this.bTable.getPoint(1).setValue(0.1);
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Beta {
    validateJmaskXml(data, 'Beta', context);
    const beta = new Beta();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 'a':
          beta.a = readDouble(node);
          break;
        case 'b':
          beta.b = readDouble(node);
          break;
        case 'aTableEnabled':
          beta.aTableEnabled = readBoolean(node);
          break;
        case 'bTableEnabled':
          beta.bTableEnabled = readBoolean(node);
          break;
        case 'table': {
          const tableId = node.getAttributeValue('tableId');
          if (tableId === 'aTable') {
            beta.aTable = Table.loadFromXML(node);
          } else if (tableId === 'bTable') {
            beta.bTable = Table.loadFromXML(node);
          }
          break;
        }
      }
    }
    return beta;
  }

  getName(): string {
    return 'Beta';
  }

  initialize(_duration: number): void {}

  getValue(time: number, rnd: JavaRandom): number {
    const localA = this.aTableEnabled ? this.aTable.getValue(time) : this.a;
    const localB = this.bTableEnabled ? this.bTable.getValue(time) : this.b;

    let x1 = 0.0;
    let x2 = 0.0;
    let yps1 = 0.0;
    let yps2 = 0.0;
    let sum = 0.0;
    do {
      x1 = rnd.nextDouble();
      x2 = rnd.nextDouble();
      yps1 = Math.pow(x1, 1.0 / localA);
      yps2 = Math.pow(x2, 1.0 / localB);
      sum = yps1 + yps2;
    } while (sum > 1.0);

    return yps1 / sum;
  }

  saveAsXML(): Element {
    const retVal = new Element('probabilityGenerator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.probability.Beta');
    retVal.addElement(writeDouble('a', this.a));
    retVal.addElement(writeDouble('b', this.b));
    retVal.addElement(writeBoolean('aTableEnabled', this.aTableEnabled));
    retVal.addElement(writeBoolean('bTableEnabled', this.bTableEnabled));

    const aTableNode = this.aTable.saveAsXML();
    aTableNode.setAttribute('tableId', 'aTable');
    retVal.addElement(aTableNode);

    const bTableNode = this.bTable.saveAsXML();
    bTableNode.setAttribute('tableId', 'bTable');
    retVal.addElement(bTableNode);
    return retVal;
  }

  deepCopy(): Beta {
    return new Beta(this);
  }
}

export class Weibull implements ProbabilityGenerator {
  s = 0.5;
  t = 2.0;
  sTableEnabled = false;
  tTableEnabled = false;
  sTable = new Table();
  tTable = new Table();

  constructor(other?: Weibull) {
    if (other) {
      this.s = other.s;
      this.t = other.t;
      this.sTableEnabled = other.sTableEnabled;
      this.tTableEnabled = other.tTableEnabled;
      this.sTable = new Table(other.sTable);
      this.tTable = new Table(other.tTable);
      return;
    }

    this.tTable.setMax(4.0, false);
    this.tTable.setMin(0.001, false);
    this.sTable.getPoint(0).setValue(0.5);
    this.sTable.getPoint(1).setValue(0.5);
    this.tTable.getPoint(0).setValue(2.0);
    this.tTable.getPoint(1).setValue(2.0);
  }

  static loadFromXML(data: Element, context = new XmlLoadContext(data)): Weibull {
    validateJmaskXml(data, 'Weibull', context);
    const weibull = new Weibull();
    const nodes = data.getElements();
    while (nodes.hasMoreElements()) {
      const node = nodes.next();
      switch (node.getName()) {
        case 's':
          weibull.s = readDouble(node);
          break;
        case 't':
          weibull.t = readDouble(node);
          break;
        case 'sTableEnabled':
          weibull.sTableEnabled = readBoolean(node);
          break;
        case 'tTableEnabled':
          weibull.tTableEnabled = readBoolean(node);
          break;
        case 'table': {
          const tableId = node.getAttributeValue('tableId');
          if (tableId === 'sTable') {
            weibull.sTable = Table.loadFromXML(node);
          } else if (tableId === 'tTable') {
            weibull.tTable = Table.loadFromXML(node);
          }
          break;
        }
      }
    }
    return weibull;
  }

  getName(): string {
    return 'Weibull';
  }

  initialize(_duration: number): void {}

  getValue(time: number, rnd: JavaRandom): number {
    const localS = this.sTableEnabled ? this.sTable.getValue(time) : this.s;
    const localT = this.tTableEnabled ? this.tTable.getValue(time) : this.t;

    let x = 0.0;
    let a = 0.0;
    let value = 0.0;
    do {
      x = rnd.nextDouble();
      a = 1.0 / (1.0 - x);
      value = localS * Math.pow(Math.log(a), 1.0 / localT);
    } while (value > 1.0);

    return value;
  }

  saveAsXML(): Element {
    const retVal = new Element('probabilityGenerator');
    retVal.setAttribute('type', 'blue.soundObject.jmask.probability.Weibull');
    retVal.addElement(writeDouble('s', this.s));
    retVal.addElement(writeDouble('t', this.t));
    retVal.addElement(writeBoolean('sTableEnabled', this.sTableEnabled));
    retVal.addElement(writeBoolean('tTableEnabled', this.tTableEnabled));

    const sTableNode = this.sTable.saveAsXML();
    sTableNode.setAttribute('tableId', 'sTable');
    retVal.addElement(sTableNode);

    const tTableNode = this.tTable.saveAsXML();
    tTableNode.setAttribute('tableId', 'tTable');
    retVal.addElement(tTableNode);
    return retVal;
  }

  deepCopy(): Weibull {
    return new Weibull(this);
  }
}
