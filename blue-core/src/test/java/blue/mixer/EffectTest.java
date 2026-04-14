package blue.mixer;

import blue.udo.OpcodeList;
import blue.udo.UDOStyle;
import blue.udo.UserDefinedOpcode;
import electric.xml.Element;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class EffectTest {

    @Test
    void classicGenerateUDOIncludesXinLine() {
        Effect effect = new Effect();
        effect.setStyle(UDOStyle.CLASSIC);
        effect.setNumIns(2);
        effect.setNumOuts(2);
        effect.setCode("aout1 = ain1\naout2 = ain2");

        OpcodeList udos = new OpcodeList();
        UserDefinedOpcode udo = effect.generateUDO(udos);

        assertEquals(UDOStyle.CLASSIC, udo.style);
        assertEquals("aa", udo.inTypes);
        assertEquals("aa", udo.outTypes);
        assertTrue(udo.codeBody.contains("xin"));
        assertTrue(udo.codeBody.contains("xout"));
        assertTrue(udo.inputArguments.isEmpty());
    }

    @Test
    void modernGenerateUDOSkipsXinLine() {
        Effect effect = new Effect();
        effect.setStyle(UDOStyle.MODERN);
        effect.setNumIns(2);
        effect.setNumOuts(2);
        effect.setCode("aout1 = ain1\naout2 = ain2");

        OpcodeList udos = new OpcodeList();
        UserDefinedOpcode udo = effect.generateUDO(udos);

        assertEquals(UDOStyle.MODERN, udo.style);
        assertEquals("ain1, ain2", udo.inputArguments);
        assertEquals("", udo.inTypes);
        assertEquals("a, a", udo.outTypes);
        assertFalse(udo.codeBody.contains("xin"));
        assertTrue(udo.codeBody.contains("xout"));
    }

    @Test
    void modernGenerateCodeUsesModernHeader() {
        Effect effect = new Effect();
        effect.setStyle(UDOStyle.MODERN);
        effect.setNumIns(1);
        effect.setNumOuts(1);
        effect.setCode("aout1 = ain1 * 0.5");

        OpcodeList udos = new OpcodeList();
        UserDefinedOpcode udo = effect.generateUDO(udos);
        udo.opcodeName = "testEffect";

        String code = udo.generateCode();
        assertTrue(code.startsWith("opcode testEffect(ain1):a\n"), code);
        assertTrue(code.contains("\n    aout1 = ain1 * 0.5\n    xout\taout1\nendop"),
                code);
        assertFalse(code.contains("\topcode"), code);
        assertFalse(code.contains("\tendop"), code);
        assertFalse(code.contains(",a,a"));
    }

    @Test
    void modernGenerateCodeMultipleOutputs() {
        Effect effect = new Effect();
        effect.setStyle(UDOStyle.MODERN);
        effect.setNumIns(1);
        effect.setNumOuts(2);
        effect.setCode("aout1 = ain1\naout2 = ain1");

        OpcodeList udos = new OpcodeList();
        UserDefinedOpcode udo = effect.generateUDO(udos);
        udo.opcodeName = "testStereo";

        assertEquals("a, a", udo.outTypes);
        String code = udo.generateCode();
        assertTrue(code.contains("opcode testStereo(ain1):(a,a)"), code);
    }

    @Test
    void legacyXmlDefaultsToClassicStyle() {
        Element xml = new Element("effect");
        xml.addElement("name").setText("legacyEffect");
        xml.addElement("enabled").setText("true");
        xml.addElement("numIns").setText("2");
        xml.addElement("numOuts").setText("2");
        xml.addElement("code").setText("aout1 = ain1");
        xml.addElement("comments").setText("");

        try {
            Effect effect = Effect.loadFromXML(xml);
            assertEquals(UDOStyle.CLASSIC, effect.getStyle());
        } catch (Exception e) {
            fail("loadFromXML threw: " + e.getMessage());
        }
    }

    @Test
    void xmlRoundTripPreservesStyle() {
        Effect effect = new Effect();
        effect.setStyle(UDOStyle.MODERN);
        effect.setName("roundTrip");
        effect.setNumIns(3);
        effect.setNumOuts(2);
        effect.setCode("aout1 = ain1 + ain2\naout2 = ain3");

        try {
            Element xml = effect.saveAsXML();
            Effect loaded = Effect.loadFromXML(xml);

            assertEquals(UDOStyle.MODERN, loaded.getStyle());
            assertEquals("roundTrip", loaded.getName());
            assertEquals(3, loaded.getNumIns());
            assertEquals(2, loaded.getNumOuts());
        } catch (Exception e) {
            fail("Round-trip threw: " + e.getMessage());
        }
    }
}
