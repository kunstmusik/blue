package blue.orchestra;

import blue.Tables;
import blue.orchestra.blueX7.AlgorithmCommonData;
import blue.orchestra.blueX7.EnvelopePoint;
import blue.orchestra.blueX7.LFOData;
import blue.orchestra.blueX7.Operator;
import blue.udo.OpcodeList;
import blue.utility.TextUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Serializable;
import java.util.Properties;
import org.apache.commons.lang3.text.StrBuilder;

/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001-2002
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 * 
 * @author unascribed
 * @version 1.0
 */

public class BlueX7 extends AbstractInstrument implements Serializable {

    private static final String BLUEX7_HAS_BEEN_COMPILED = "blueX7.hasStaticTablesBeenCompiled";

    private static transient int sineTable = 0;

    private static transient int outputAmpTable = 0;

    private static transient int rateScaleTable = 0;

    private static transient int egRateRiseLvlTable = 0;

    private static transient int egRateRisePercentageTable = 0;

    private static transient int egRateDecayLvlTable = 0;

    private static transient int egRateDecayPercentageTable = 0;

    private static transient int egLevelPeakTable = 0;

    private static transient int velAmpTable = 0;

    private static transient int velSensitivityTable = 0;

    private static transient int feedbackScaleTable = 0;

    Properties props = new Properties();

    public AlgorithmCommonData algorithmCommon = new AlgorithmCommonData();

    public LFOData lfo = new LFOData();

    public Operator[] operators = new Operator[6];

    public EnvelopePoint[] peg = new EnvelopePoint[4];

    public transient int[] operatorTableNums = null;

    public BlueX7() {

        for (int i = 0; i < operators.length; i++) {
            operators[i] = new Operator();
        }

        for (int i = 0; i < peg.length; i++) {
            peg[i] = new EnvelopePoint();
            peg[i].x = 50;
            peg[i].y = 50;
        }

        setDefaults();

        props.put("postCode", "blueMixerOut aout, aout");
    }

    public void setProperty(String key, String val) {
        props.setProperty(key, val);
    }

    public String getProperty(String key) {
        if (props == null) {
            props = new Properties();
            return "";
        }

        String prop = props.getProperty(key);
        if (prop == null) {
            return "";
        }
        return prop;
    }

    public boolean hasFTable() {
        return true;
    }

    public void generateUserDefinedOpcodes(OpcodeList udos) {
    }

    public void generateFTables(Tables tables) {
        StrBuilder buffer = new StrBuilder();

        Object obj = tables.getCompilationVariable(BLUEX7_HAS_BEEN_COMPILED);

        // adding FTables that all BlueX7 generated instruments will use (start
        // static ftable generation)
        if (obj == null || obj != Boolean.TRUE) {

            tables.setCompilationVariable(BLUEX7_HAS_BEEN_COMPILED,
                    Boolean.TRUE);

            // assigning static table numbers
            sineTable = tables.getOpenFTableNumber();
            outputAmpTable = tables.getOpenFTableNumber();
            rateScaleTable = tables.getOpenFTableNumber();
            egRateRiseLvlTable = tables.getOpenFTableNumber();
            egRateRisePercentageTable = tables.getOpenFTableNumber();
            egRateDecayLvlTable = tables.getOpenFTableNumber();
            egRateDecayPercentageTable = tables.getOpenFTableNumber();
            egLevelPeakTable = tables.getOpenFTableNumber();
            velAmpTable = tables.getOpenFTableNumber();
            velSensitivityTable = tables.getOpenFTableNumber();
            feedbackScaleTable = tables.getOpenFTableNumber();

            buffer.append("; [BLUEX7] - START STATIC TABLES");
            buffer.append("; sine wave\n");
            buffer.append("f" + sineTable + "     0       512     10      1\n");

            buffer
                    .append("; operator output level to amp scale function (data from Chowning/Bristow)\n");
            buffer
                    .append("f"
                            + outputAmpTable
                            + "     0       128     7       0       10      .003    10      .013");
            buffer
                    .append("       10      .031    10      .079    10      .188    10      .446");
            buffer
                    .append("       5       .690    5       1.068   5       1.639   5       2.512");
            buffer
                    .append("       5       3.894   5       6.029   5       9.263   4       13.119");
            buffer.append("       29      13.119\n");

            buffer.append("; rate scaling function\n");
            buffer.append("f" + rateScaleTable
                    + "     0       128     7       0       128     1\n");

            buffer
                    .append("; eg rate rise function for lvl change between 0 and 99 (data from Opcode)\n");
            buffer
                    .append("f"
                            + egRateRiseLvlTable
                            + "     0       128     -7      38      5       22.8    5       12      5");
            buffer
                    .append("       7.5     5       4.8     5       2.7     5       1.8     5       1.3");
            buffer
                    .append("       8       .737    3       .615    3       .505    3       .409    3");
            buffer
                    .append("       .321    6       .080    6       .055    2       .032    3       .024");
            buffer
                    .append("       3       .018    3       .014    3       .011    3       .008    3");
            buffer
                    .append("       .008    3       .007    3       .005    3       .003    32      .003\n");

            buffer.append("; eg rate rise percentage function\n");
            buffer
                    .append("f"
                            + egRateRisePercentageTable
                            + "     0       128     -7      .00001  31      .00001  4       .02     5");
            buffer
                    .append("       .06     10      .14     10      .24     10      .35     10      .50");
            buffer
                    .append("       10      .70     5       .86     4       1.0     29      1.0\n");

            buffer
                    .append("; eg rate decay function for lvl change between 0 and 99\n");
            buffer
                    .append("f"
                            + egRateDecayLvlTable
                            + "     0       128     -7      318     4       181     5       115     5");
            buffer
                    .append("       63      5       39.7    5       20      5       11.2    5       7");
            buffer
                    .append("       8       5.66    3       3.98    6       1.99    3       1.34    3");
            buffer
                    .append("       .99     3       .71     5       .41     3       .15     3       .081");
            buffer
                    .append("       3       .068    3       .047    3       .037    3       .025    3");
            buffer
                    .append("       .02     3       .013    3       .008    36      .008\n");

            buffer.append("; eg rate decay percentage function\n");
            buffer
                    .append("f"
                            + egRateDecayPercentageTable
                            + "     0       128     -7      .00001  10      .25     10      .35     10");
            buffer
                    .append("     .43     10      .52     10      .59     10      .70     10      .77");
            buffer
                    .append("     10      .84     10      .92     9       1.0     29      1.0\n");

            buffer
                    .append("; eg level to peak deviation mapping function (index in radians = Index / 2PI)\n");
            buffer
                    .append("f"
                            + egLevelPeakTable
                            + "     0       128     -7      0       10      .000477 10      .002");
            buffer
                    .append("     10      .00493  10      .01257  10      .02992  10      .07098");
            buffer
                    .append("     5       .10981  5       .16997  5       .260855 5       .39979");
            buffer
                    .append("     5       .61974  5       .95954  5       1.47425 4       2.08795");
            buffer.append("     29      2.08795\n");

            buffer
                    .append("; velocity to amp factor mapping function (rough guess)\n");
            buffer.append("f" + velAmpTable
                    + "     0       129     9       .25     1       0\n");

            buffer.append("; velocity sensitivity scaling function\n");
            buffer.append("f" + velSensitivityTable
                    + "     0       8       -7      0       8       1\n");

            buffer.append("; feedback scaling function\n");
            buffer.append("f" + feedbackScaleTable
                    + "     0       8       -7      0       8       7\n");

            buffer.append("; [BLUEX7] - END STATIC TABLES\n\n");

        } // end static ftable generation

        buffer.append("; FTABLES FOR BLUEX7 INSTRUMENT: " + this.getName()
                + "\n");
        operatorTableNums = new int[6];

        for (int i = 0; i < 6; i++) {
            operatorTableNums[i] = tables.getOpenFTableNumber();
            buffer.append(generateFTableForOperator(this.operators[i],
                    operatorTableNums[i])
                    + "\n");
        }

        buffer.append("\n");

        tables.setTables(tables.getTables() + "\n" + buffer.toString());
    }

    private String generateFTableForOperator(Operator op, int tableNum) {
        StrBuilder buffer = new StrBuilder();

        buffer.append("f ").append(tableNum).append(" 0 32 -2 ");
        buffer.append(Integer.toString(op.outputLevel)).append(" ");
        buffer.append(Integer.toString(op.velocitySensitivity)).append(" ");
        buffer.append(Integer.toString(op.envelopePoints[0].x)).append(" ");
        buffer.append(Integer.toString(op.envelopePoints[1].x)).append(" ");
        buffer.append(Integer.toString(op.envelopePoints[2].x)).append(" ");
        buffer.append(Integer.toString(op.envelopePoints[3].x)).append(" ");
        buffer.append(Integer.toString(op.envelopePoints[0].y)).append(" ");
        buffer.append(Integer.toString(op.envelopePoints[1].y)).append(" ");
        buffer.append(Integer.toString(op.envelopePoints[2].y)).append(" ");
        buffer.append(Integer.toString(op.envelopePoints[3].y)).append(" ");
        buffer.append(Integer.toString(op.modulationAmplitude)).append(" ");
        buffer.append(Integer.toString(op.mode)).append(" ");
        // buffer.append(Integer.toString(op.freqCoarse) + " ");
        buffer.append(Integer.toString(1)).append(" ");
        buffer.append(Integer.toString(op.detune)).append(" ");
        buffer.append(Integer.toString(op.keyboardRateScaling)).append(" ");
        buffer.append("0 \n"); // adding 0 to fill table

        return buffer.toString();
    }

    public String generateInstrument() {
        String algNum = this.algorithmCommon.algorithm < 10 ? "0"
                + this.algorithmCommon.algorithm : Integer
                .toString(this.algorithmCommon.algorithm);
        StrBuilder buffer = new StrBuilder();

        try {
            try (BufferedReader br = new BufferedReader(new InputStreamReader(
                         this.getClass().getClassLoader().getResourceAsStream(
                                 "blue/resources/blueX7/dx7" + algNum + ".orc")))) {
                String line;
                while ((line = br.readLine()) != null) {
                    buffer.append(line).append("\n");
                }
            }

        } catch (IOException ioe) {
            System.err.println("[error] BlueX7::generateInstrument");
            return "";
        }

        String credits = "; Instrument derived from Russell Pinkston's DX7 emulation patches\n"
                + "; Code from Jeff Harrington's DX72SCO consulted in building BlueX7\n"
                + "; as well as the JSynthLib project\n";

        buffer.insert(0, credits);

        String instrText = buffer.toString();
        instrText = instrText.substring(instrText.indexOf('\n', instrText
                .indexOf("instr")) + 1);
        instrText = instrText.substring(0, instrText.indexOf("endin") - 1);

        instrText = TextUtilities.replace(instrText, "abs(p3)", "idur");
        instrText = TextUtilities.replace(instrText, "ihold",
                "idur \t= abs(p3) \np3 = p3 + 4");
        instrText = TextUtilities.replace(instrText, "cpspch(p4)",
                "(p4 < 15 ? cpspch(p4) : p4)");
        instrText = TextUtilities.replace(instrText, "octpch(p4)",
                "(p4 < 15 ? octpch(p4) : p4)");

        /* Static FTable Swap */

        instrText = TextUtilities.replace(instrText, "p16", Integer
                .toString(outputAmpTable));
        // instrText = TextUtilities.replace(instrText, "p17",
        // Integer.toString(peakAmp)); // some multiplier value
        instrText = TextUtilities.replace(instrText, "p17", "5000");
        // some multiplier value, maybe should map output level
        instrText = TextUtilities.replace(instrText, "p18", Integer
                .toString(rateScaleTable));
        instrText = TextUtilities.replace(instrText, "p19", Integer
                .toString(egLevelPeakTable));
        instrText = TextUtilities.replace(instrText, "p20", Integer
                .toString(egRateRiseLvlTable));
        instrText = TextUtilities.replace(instrText, "p21", Integer
                .toString(egRateDecayLvlTable));
        instrText = TextUtilities.replace(instrText, "p22", Integer
                .toString(velSensitivityTable));
        instrText = TextUtilities.replace(instrText, "p23", Integer
                .toString(velAmpTable));
        instrText = TextUtilities.replace(instrText, "p24", Integer
                .toString(feedbackScaleTable));

        /* Swapping other values */

        instrText = TextUtilities.replace(instrText, "p25", Integer
                .toString(this.algorithmCommon.feedback));

        for (int i = 0; i < 6; i++) {
            instrText = TextUtilities.replace(instrText, "p" + (i + 10),
                    Integer.toString(operatorTableNums[i]));
        }

        int pos = instrText.lastIndexOf("out");
        instrText = instrText.substring(0, pos) + "aout = "
                + instrText.substring(pos + 7);

        instrText += "\n" + this.getProperty("postCode");

        // egRateRisePercentageTable = tables.getOpenFTableNumber(); unused
        // egRateDecayPercentageTable = tables.getOpenFTableNumber(); unused

        return instrText;
    }

    @Override
    public String toString() {
        return this.name;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.Instrument#generateGlobalOrc()
     */
    public String generateGlobalOrc() {
        return null;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.Instrument#generateGlobalSco()
     */
    public String generateGlobalSco() {
        return null;
    }

    public static Instrument loadFromXML(Element data) throws Exception {
        BlueX7 instr = new BlueX7();

        InstrumentUtilities.initBasicFromXML(data, instr);

        instr.algorithmCommon = AlgorithmCommonData.loadFromXML(data
                .getElement("algorithmCommonData"));

        instr.lfo = LFOData.loadFromXML(data.getElement("lfoData"));

        Elements ops = data.getElements("operator");
        int counter = 0;

        while (ops.hasMoreElements()) {
            instr.operators[counter] = Operator.loadFromXML(ops.next());
            counter++;
        }

        Elements pegPoints = data.getElements("envelopePoint");
        counter = 0;

        while (pegPoints.hasMoreElements()) {
            instr.peg[counter] = EnvelopePoint.loadFromXML(pegPoints.next());
            counter++;
        }

        try {
            instr.setProperty("postCode", data.getTextString("csoundPostCode"));
        } catch (Exception e) {

        }

        return instr;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.Instrument#saveAsXML()
     */
    public Element saveAsXML() {
        Element retVal = InstrumentUtilities.getBasicXML(this);

        retVal.addElement(algorithmCommon.saveAsXML());
        retVal.addElement(lfo.saveAsXML());

        for (int i = 0; i < operators.length; i++) {
            retVal.addElement(operators[i].saveAsXML());
        }

        for (int i = 0; i < peg.length; i++) {
            retVal.addElement(peg[i].saveAsXML());
        }

        retVal.addElement("csoundPostCode").setText(getProperty("postCode"));

        return retVal;
    }

    private void setDefaults() {
        this.algorithmCommon.algorithm = 19;
        this.algorithmCommon.keyTranspose = 24;
        this.algorithmCommon.feedback = 6;

        this.lfo.speed = 35;

        this.operators[0].mode = 0;
        this.operators[0].sync = 1;
        this.operators[0].freqCoarse = 0;
        this.operators[0].freqFine = 1;
        this.operators[0].detune = -3;
        this.operators[0].breakpoint = 0;
        this.operators[0].curveLeft = 0;
        this.operators[0].curveRight = 3;
        this.operators[0].depthLeft = 85;
        this.operators[0].depthRight = 0;
        this.operators[0].keyboardRateScaling = 4;
        this.operators[0].outputLevel = 99;
        this.operators[0].velocitySensitivity = 2;
        this.operators[0].modulationAmplitude = 0;
        this.operators[0].modulationPitch = 0;
        this.operators[0].envelopePoints[0].x = 81;
        this.operators[0].envelopePoints[0].y = 99;
        this.operators[0].envelopePoints[1].x = 25;
        this.operators[0].envelopePoints[1].y = 82;
        this.operators[0].envelopePoints[2].x = 20;
        this.operators[0].envelopePoints[2].y = 0;
        this.operators[0].envelopePoints[3].x = 48;
        this.operators[0].envelopePoints[3].y = 0;

        this.operators[1].mode = 0;
        this.operators[1].sync = 1;
        this.operators[1].freqCoarse = 1;
        this.operators[1].freqFine = 0;
        this.operators[1].detune = 1;
        this.operators[1].breakpoint = 0;
        this.operators[1].curveLeft = 0;
        this.operators[1].curveRight = 0;
        this.operators[1].depthLeft = 0;
        this.operators[1].depthRight = 13;
        this.operators[1].keyboardRateScaling = 5;
        this.operators[1].outputLevel = 87;
        this.operators[1].velocitySensitivity = 0;
        this.operators[1].modulationAmplitude = 0;
        this.operators[1].modulationPitch = 0;
        this.operators[1].envelopePoints[0].x = 99;
        this.operators[1].envelopePoints[0].y = 99;
        this.operators[1].envelopePoints[1].x = 0;
        this.operators[1].envelopePoints[1].y = 75;
        this.operators[1].envelopePoints[2].x = 25;
        this.operators[1].envelopePoints[2].y = 0;
        this.operators[1].envelopePoints[3].x = 0;
        this.operators[1].envelopePoints[3].y = 0;

        this.operators[2].mode = 0;
        this.operators[2].sync = 1;
        this.operators[2].freqCoarse = 3;
        this.operators[2].freqFine = 0;
        this.operators[2].detune = -1;
        this.operators[2].breakpoint = 47;
        this.operators[2].curveLeft = 0;
        this.operators[2].curveRight = 3;
        this.operators[2].depthLeft = 28;
        this.operators[2].depthRight = 74;
        this.operators[2].keyboardRateScaling = 5;
        this.operators[2].outputLevel = 57;
        this.operators[2].velocitySensitivity = 0;
        this.operators[2].modulationAmplitude = 0;
        this.operators[2].modulationPitch = 0;
        this.operators[2].envelopePoints[0].x = 81;
        this.operators[2].envelopePoints[0].y = 99;
        this.operators[2].envelopePoints[1].x = 25;
        this.operators[2].envelopePoints[1].y = 99;
        this.operators[2].envelopePoints[2].x = 25;
        this.operators[2].envelopePoints[2].y = 99;
        this.operators[2].envelopePoints[3].x = 14;
        this.operators[2].envelopePoints[3].y = 0;

        this.operators[3].mode = 0;
        this.operators[3].sync = 1;
        this.operators[3].freqCoarse = 1;
        this.operators[3].freqFine = 0;
        this.operators[3].detune = 1;
        this.operators[3].breakpoint = 0;
        this.operators[3].curveLeft = 0;
        this.operators[3].curveRight = 0;
        this.operators[3].depthLeft = 0;
        this.operators[3].depthRight = 0;
        this.operators[3].keyboardRateScaling = 5;
        this.operators[3].outputLevel = 99;
        this.operators[3].velocitySensitivity = 2;
        this.operators[3].modulationAmplitude = 0;
        this.operators[3].modulationPitch = 0;
        this.operators[3].envelopePoints[0].x = 81;
        this.operators[3].envelopePoints[0].y = 99;
        this.operators[3].envelopePoints[1].x = 23;
        this.operators[3].envelopePoints[1].y = 78;
        this.operators[3].envelopePoints[2].x = 22;
        this.operators[3].envelopePoints[2].y = 0;
        this.operators[3].envelopePoints[3].x = 45;
        this.operators[3].envelopePoints[3].y = 0;

        this.operators[4].mode = 0;
        this.operators[4].sync = 1;
        this.operators[4].freqCoarse = 1;
        this.operators[4].freqFine = 58;
        this.operators[4].detune = -1;
        this.operators[4].breakpoint = 48;
        this.operators[4].curveLeft = 0;
        this.operators[4].curveRight = 0;
        this.operators[4].depthLeft = 0;
        this.operators[4].depthRight = 65;
        this.operators[4].keyboardRateScaling = 5;
        this.operators[4].outputLevel = 93;
        this.operators[4].velocitySensitivity = 0;
        this.operators[4].modulationAmplitude = 0;
        this.operators[4].modulationPitch = 0;
        this.operators[4].envelopePoints[0].x = 81;
        this.operators[4].envelopePoints[0].y = 99;
        this.operators[4].envelopePoints[1].x = 58;
        this.operators[4].envelopePoints[1].y = 14;
        this.operators[4].envelopePoints[2].x = 36;
        this.operators[4].envelopePoints[2].y = 0;
        this.operators[4].envelopePoints[3].x = 39;
        this.operators[4].envelopePoints[3].y = 0;

        this.operators[5].mode = 0;
        this.operators[5].sync = 1;
        this.operators[5].freqCoarse = 1;
        this.operators[5].freqFine = 0;
        this.operators[5].detune = -1;
        this.operators[5].breakpoint = 0;
        this.operators[5].curveLeft = 0;
        this.operators[5].curveRight = 0;
        this.operators[5].depthLeft = 0;
        this.operators[5].depthRight = 10;
        this.operators[5].keyboardRateScaling = 5;
        this.operators[5].outputLevel = 82;
        this.operators[5].velocitySensitivity = 0;
        this.operators[5].modulationAmplitude = 0;
        this.operators[5].modulationPitch = 0;
        this.operators[5].envelopePoints[0].x = 99;
        this.operators[5].envelopePoints[0].y = 99;
        this.operators[5].envelopePoints[1].x = 67;
        this.operators[5].envelopePoints[1].y = 50;
        this.operators[5].envelopePoints[2].x = 95;
        this.operators[5].envelopePoints[2].y = 50;
        this.operators[5].envelopePoints[3].x = 60;
        this.operators[5].envelopePoints[3].y = 50;
    }
}