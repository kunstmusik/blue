package blue.utility;

import blue.udo.OpcodeList;
import blue.udo.UDOStyle;
import blue.udo.UserDefinedOpcode;
import electric.xml.Element;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;

class UDOUtilitiesTest {

    @Test
    void parsesModernUDOText() {
        String text = """
                opcode saturate(aSig, kDrive):a
                aOut = tanh(aSig * kDrive)
                xout aOut
                endop
                """;

        OpcodeList udos = UDOUtilities.parseUDOText(text);

        assertEquals(1, udos.size());

        UserDefinedOpcode udo = udos.get(0);
        assertEquals(UDOStyle.MODERN, udo.style);
        assertEquals("saturate", udo.opcodeName);
        assertEquals("aSig, kDrive", udo.inputArguments);
        assertEquals("ak", UDOUtilities.getInTypesFromInputArguments(udo.inputArguments));
        assertEquals("a", udo.outTypes);
    }

    @Test
    void parsesModernUDOTextWithAnnotatedArgsAndSpacedColon() {
        String text = """
                opcode myOpcode(kIn1:o, kIn2:j) : a
                xout 0
                endop
                """;

        OpcodeList udos = UDOUtilities.parseUDOText(text);

        assertEquals(1, udos.size());

        UserDefinedOpcode udo = udos.get(0);
        assertEquals(UDOStyle.MODERN, udo.style);
        assertEquals("myOpcode", udo.opcodeName);
        assertEquals("kIn1:o, kIn2:j", udo.inputArguments);
        assertEquals("oj", UDOUtilities.getInTypesFromInputArguments(udo.inputArguments));
        assertEquals("a", udo.outTypes);
    }

    @Test
    void parsesModernUDOTextWhenColonStartsNextLine() {
        String text = """
                opcode nextLineColon(aSig, kDrive)
                : (a, a)
                xout aSig, aSig
                endop
                """;

        OpcodeList udos = UDOUtilities.parseUDOText(text);

        assertEquals(1, udos.size());

        UserDefinedOpcode udo = udos.get(0);
        assertEquals(UDOStyle.MODERN, udo.style);
        assertEquals("nextLineColon", udo.opcodeName);
        assertEquals("aSig, kDrive", udo.inputArguments);
        assertEquals("a, a", udo.outTypes);
    }

    @Test
    void recoversWhenBrokenModernHeaderIsFollowedByAnotherOpcode() {
        String text = """
                opcode broken(aSig)
                opcode next, a, a
                aSig\txin
                xout aSig
                endop
                """;

        OpcodeList udos = UDOUtilities.parseUDOText(text);

        assertEquals(1, udos.size());

        UserDefinedOpcode udo = udos.get(0);
        assertEquals(UDOStyle.CLASSIC, udo.style);
        assertEquals("next", udo.opcodeName);
        assertEquals("a", udo.outTypes);
        assertEquals("a", udo.inTypes);
    }

    @Test
    void parsesClassicUDOText() {
        String text = """
                opcode saturate, a, ak
                aSig, kDrive\txin
                aOut = tanh(aSig * kDrive)
                xout aOut
                endop
                """;

        OpcodeList udos = UDOUtilities.parseUDOText(text);

        assertEquals(1, udos.size());

        UserDefinedOpcode udo = udos.get(0);
        assertEquals(UDOStyle.CLASSIC, udo.style);
        assertEquals("a", udo.outTypes);
        assertEquals("ak", udo.inTypes);
    }

    @Test
    void convertsClassicToModernUsingXinArguments() {
        UserDefinedOpcode udo = new UserDefinedOpcode();
        udo.style = UDOStyle.CLASSIC;
        udo.opcodeName = "saturate";
        udo.inTypes = "ak";
        udo.outTypes = "a";
        udo.codeBody = """
                aSig, kDrive\txin
                aOut = tanh(aSig * kDrive)
                xout aOut
                """;

        UDOUtilities.convertToModern(udo);

        assertEquals(UDOStyle.MODERN, udo.style);
        assertEquals("aSig, kDrive", udo.inputArguments);
        assertEquals("", udo.inTypes);
        assertFalse(udo.codeBody.contains("xin"));
        assertEquals("ak", UDOUtilities.getInTypesFromInputArguments(udo.inputArguments));
        assertEquals("a", udo.outTypes);
    }

    @Test
    void convertsClassicToModernPreservesLegacyInputKinds() {
        UserDefinedOpcode udo = new UserDefinedOpcode();
        udo.style = UDOStyle.CLASSIC;
        udo.opcodeName = "legacyKinds";
        udo.inTypes = "oj";
        udo.outTypes = "a";
        udo.codeBody = """
                kIn1, kIn2\txin
                xout 0
                """;

        UDOUtilities.convertToModern(udo);

        assertEquals(UDOStyle.MODERN, udo.style);
        assertEquals("kIn1:o, kIn2:j", udo.inputArguments);
        assertEquals("", udo.inTypes);
    }

    @Test
    void convertsModernToClassic() {
        UserDefinedOpcode udo = new UserDefinedOpcode();
        udo.style = UDOStyle.MODERN;
        udo.opcodeName = "saturate";
        udo.inputArguments = "aSig, kDrive";
        udo.outTypes = "a";
        udo.codeBody = """
                aOut = tanh(aSig * kDrive)
                xout aOut
                """;

        UDOUtilities.convertToClassic(udo);

        assertEquals(UDOStyle.CLASSIC, udo.style);
        assertEquals("ak", udo.inTypes);
        assertEquals("a", udo.outTypes);
        assertTrue(udo.codeBody.startsWith("aSig, kDrive\txin"));
        assertEquals("", udo.inputArguments);
    }

    @Test
    void convertsAnnotatedModernToClassicWithoutKeepingAnnotationsInXin() {
        UserDefinedOpcode udo = new UserDefinedOpcode();
        udo.style = UDOStyle.MODERN;
        udo.opcodeName = "legacyKinds";
        udo.inputArguments = "kIn1:o, kIn2:j";
        udo.outTypes = "a";
        udo.codeBody = "xout 0\n";

        UDOUtilities.convertToClassic(udo);

        assertEquals(UDOStyle.CLASSIC, udo.style);
        assertEquals("oj", udo.inTypes);
        assertTrue(udo.codeBody.startsWith("kIn1, kIn2\txin"));
        assertFalse(udo.codeBody.startsWith("kIn1:o"));
    }

    @Test
    void savesLoadsAndGeneratesModernUDO() {
        UserDefinedOpcode udo = new UserDefinedOpcode();
        udo.style = UDOStyle.MODERN;
        udo.opcodeName = "stereo_width";
        udo.inputArguments = "aSig, kWidth";
        udo.outTypes = "a, a";
        udo.codeBody = """
                aDel = delay(aSig, kWidth)
                xout aSig, aDel
                """;

        UserDefinedOpcode copy = UserDefinedOpcode.loadFromXML(udo.saveAsXML());

        assertEquals(UDOStyle.MODERN, copy.style);
        assertEquals("aSig, kWidth", copy.inputArguments);
        assertEquals("", copy.inTypes);
        assertEquals("a, a", copy.outTypes);
        assertTrue(copy.generateCode().startsWith("opcode stereo_width(aSig, kWidth):(a,a)\n"));
    }

    @Test
    void parsedModernUDORemainsEquivalentAfterXmlRoundTrip() {
        UserDefinedOpcode parsed = UDOUtilities.parseUDOText("""
                opcode foo(kIn1:o, kIn2:j):a
                xout 0
                endop
                """).get(0);

        UserDefinedOpcode loaded = UserDefinedOpcode.loadFromXML(parsed.saveAsXML());

        assertTrue(loaded.isEquivalent(parsed));
    }

    @Test
    void modernEquivalentComparisonIgnoresOutTypeSpacing() {
        UserDefinedOpcode udo = new UserDefinedOpcode();
        udo.style = UDOStyle.MODERN;
        udo.opcodeName = "fx";
        udo.inputArguments = "ain1, ain2";
        udo.outTypes = "a, a";
        udo.codeBody = "xout ain1, ain2";

        UserDefinedOpcode parsed = new UserDefinedOpcode(udo);
        parsed.outTypes = "a,a";

        assertTrue(udo.isEquivalent(parsed));

        OpcodeList list = new OpcodeList();
        list.addOpcode(udo);
        assertEquals("fx", list.getNameOfEquivalentCopy(parsed));
    }

    @Test
    void parsesModernUDOWithVoidOutput() {
        String text = """
                opcode logMsg(SMsg):void
                prints SMsg
                endop
                """;

        OpcodeList udos = UDOUtilities.parseUDOText(text);
        assertEquals(1, udos.size());

        UserDefinedOpcode udo = udos.get(0);
        assertEquals(UDOStyle.MODERN, udo.style);
        assertEquals("logMsg", udo.opcodeName);
        assertEquals("", udo.outTypes);

        String code = udo.generateCode();
        assertTrue(code.contains("opcode logMsg(SMsg):void"), code);
    }

    @Test
    void parsesModernUDOWithEmptyOutputList() {
        String text = """
                opcode logMsg(SMsg):()
                prints SMsg
                endop
                """;

        OpcodeList udos = UDOUtilities.parseUDOText(text);
        assertEquals(1, udos.size());

        UserDefinedOpcode udo = udos.get(0);
        assertEquals(UDOStyle.MODERN, udo.style);
        assertEquals("", udo.outTypes);
        assertTrue(udo.generateCode().contains("opcode logMsg(SMsg):void"));
    }

    @Test
    void parsesModernUDOWithMultipleOutputTypes() {
        String text = """
                opcode stereoSplit(aSig, kPan):(a, a)
                aL = aSig * (1 - kPan)
                aR = aSig * kPan
                xout aL, aR
                endop
                """;

        OpcodeList udos = UDOUtilities.parseUDOText(text);
        assertEquals(1, udos.size());

        UserDefinedOpcode udo = udos.get(0);
        assertEquals(UDOStyle.MODERN, udo.style);
        assertEquals("a, a", udo.outTypes);
        assertEquals("ak", UDOUtilities.getInTypesFromInputArguments(udo.inputArguments));

        String code = udo.generateCode();
        assertTrue(code.contains("opcode stereoSplit(aSig, kPan):(a,a)"), code);
    }

    @Test
    void convertsClassicToModernWithMultipleOutputs() {
        UserDefinedOpcode udo = new UserDefinedOpcode();
        udo.style = UDOStyle.CLASSIC;
        udo.opcodeName = "stereo";
        udo.inTypes = "a";
        udo.outTypes = "aa";
        udo.codeBody = """
                aSig\txin
                xout aSig, aSig
                """;

        UDOUtilities.convertToModern(udo);

        assertEquals(UDOStyle.MODERN, udo.style);
        assertEquals("a, a", udo.outTypes);
    }

    @Test
    void convertsClassicZeroOutputToModernVoidGeneration() {
        UserDefinedOpcode udo = new UserDefinedOpcode();
        udo.style = UDOStyle.CLASSIC;
        udo.opcodeName = "logMsg";
        udo.inTypes = "S";
        udo.outTypes = "0";
        udo.codeBody = """
                SMsg\txin
                prints SMsg
                """;

        UDOUtilities.convertToModern(udo);

        assertEquals("", udo.outTypes);
        assertTrue(udo.generateCode().contains("opcode logMsg(SMsg):void"));
    }

    @Test
    void convertsModernVoidToClassicZero() {
        UserDefinedOpcode udo = new UserDefinedOpcode();
        udo.style = UDOStyle.MODERN;
        udo.opcodeName = "logMsg";
        udo.inputArguments = "SMsg";
        udo.outTypes = "";
        udo.codeBody = "prints SMsg\n";

        UDOUtilities.convertToClassic(udo);

        assertEquals(UDOStyle.CLASSIC, udo.style);
        assertEquals("0", udo.outTypes);
        assertEquals("S", udo.inTypes);
    }

    @Test
    void modernGenerateCodeUsesFlushHeaderAndIndentedBody() {
        UserDefinedOpcode udo = new UserDefinedOpcode();
        udo.style = UDOStyle.MODERN;
        udo.opcodeName = "logMsg";
        udo.inputArguments = "SMsg";
        udo.outTypes = "";
        udo.codeBody = """
                prints SMsg
                xout 0
                """;

        String code = udo.generateCode();

        assertEquals("""
                opcode logMsg(SMsg):void
                    prints SMsg
                    xout 0
                endop""", code);
    }

    @Test
    void savesModernVoidOutTypesAsVoidTextInXml() {
        UserDefinedOpcode udo = new UserDefinedOpcode();
        udo.style = UDOStyle.MODERN;
        udo.opcodeName = "logMsg";
        udo.inputArguments = "SMsg";
        udo.outTypes = "";
        udo.codeBody = "prints SMsg\n";

        Element xml = udo.saveAsXML();

        assertEquals("void", xml.getElement("outTypes").getTextString());

        UserDefinedOpcode loaded = UserDefinedOpcode.loadFromXML(xml);
        assertEquals("", loaded.outTypes);
        assertTrue(loaded.generateCode().contains("opcode logMsg(SMsg):void"));
    }

    @Test
    void modernOutputSignatureHandlesVoid() {
        assertEquals("void", UDOUtilities.getModernOutputSignature("void"));
        assertEquals("void", UDOUtilities.getModernOutputSignature("0"));
        assertEquals("void", UDOUtilities.getModernOutputSignature(""));
        assertEquals("void", UDOUtilities.getModernOutputSignature("()"));
        assertEquals("a", UDOUtilities.getModernOutputSignature("a"));
        assertEquals("(a,k)", UDOUtilities.getModernOutputSignature("a, k"));
    }

    @Test
    void modernOutTypesDisplayUsesVoidForZeroOutput() {
        assertEquals("void", UDOUtilities.getModernOutTypesDisplay("void"));
        assertEquals("void", UDOUtilities.getModernOutTypesDisplay("0"));
        assertEquals("void", UDOUtilities.getModernOutTypesDisplay(""));
        assertEquals("void", UDOUtilities.getModernOutTypesDisplay("()"));
        assertEquals("a, a", UDOUtilities.getModernOutTypesDisplay("a, a"));
    }
}
