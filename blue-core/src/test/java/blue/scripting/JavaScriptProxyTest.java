/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.scripting;

import blue.BlueData;
import blue.BlueSystem;
import java.io.StringReader;
import java.io.StringWriter;
import javax.script.ScriptException;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;

/**
 *
 * @author stevenyi
 */
@Execution(ExecutionMode.SAME_THREAD)
class JavaScriptProxyTest {

    public JavaScriptProxyTest() {
    }

    @BeforeAll
    public static void setUpClass() throws Exception {
    }

    @AfterAll
    public static void tearDownClass() throws Exception {
    }

    @BeforeEach
    void setUp() {
                BlueSystem.setCurrentBlueData(new BlueData());
                BlueSystem.setCurrentProjectDirectory(null);
    }

    @AfterEach
    void tearDown() {
                BlueSystem.setCurrentBlueData(null);
                BlueSystem.setCurrentProjectDirectory(null);
    }

    /**
     * Test of processJavascriptScore method, of class JavaScriptProxy.
     */
    @Test
    void testProcessJavascriptScore() throws ScriptException {
        String script = "function f(num) {\n";
        script += "  returnText = '';\n";
        script += "for(var i = 0; i < num; i++) {\n";
        script += "returnText += 'i1 ' + i + ' 1 2 3 4 5\\n';\n";
        script += "}\n";
        script += "return returnText;\n";
        script += "}\n";
        script += "score = f(4);";
        script += "score += f(5);";

        String testScore = "i1 0 1 2 3 4 5"
                + "\ni1 1 1 2 3 4 5"
                + "\ni1 2 1 2 3 4 5"
                + "\ni1 3 1 2 3 4 5"
                + "\ni1 0 1 2 3 4 5"
                + "\ni1 1 1 2 3 4 5"
                + "\ni1 2 1 2 3 4 5"
                + "\ni1 3 1 2 3 4 5"
                + "\ni1 4 1 2 3 4 5\n";

        assertEquals(testScore, JavaScriptProxy.processJavascriptScore(script, 0.0f,
                "unit test 1"));

        System.out.println(JavaScriptProxy.processJavascriptScore(
                "score += '\\nhi\\n'", 0.0f, "unit test 2"));
        JavaScriptProxy.reinitialize();

        System.out.println(JavaScriptProxy.processJavascriptScore(
                "score += '\\nhi\\n'", 0.0f, "unit test 3"));
    }

    @Test
        void testProcessScriptPreservesSharedEngineState() throws Exception {
        JavaScriptProxy.reinitialize();

        StringWriter stdout = new StringWriter();
        StringWriter stderr = new StringWriter();

        Object result = JavaScriptProxy.processScript("var counter = 2; counter;",
                new StringReader(""), stdout, stderr);

        assertEquals("2", String.valueOf(result));
        assertEquals("", stderr.toString());

        stdout.getBuffer().setLength(0);
        result = JavaScriptProxy.processScript("counter += 5; counter;",
                new StringReader(""), stdout, stderr);

        assertEquals("7", String.valueOf(result));
        assertEquals("", stderr.toString());
    }

    @Test
    void testProcessScriptUsesPerProjectEngineState() throws Exception {
        BlueData projectOne = new BlueData();
        BlueData projectTwo = new BlueData();

        BlueSystem.setCurrentBlueData(projectOne);
        JavaScriptProxy.reinitialize();
        assertEquals("p1", String.valueOf(JavaScriptProxy.processScript(
                "var projectValue = 'p1'; projectValue;",
                new StringReader(""), new StringWriter(), new StringWriter())));

        BlueSystem.setCurrentBlueData(projectTwo);
        JavaScriptProxy.reinitialize();
        assertEquals("undefined", String.valueOf(JavaScriptProxy.processScript(
                "typeof projectValue;",
                new StringReader(""), new StringWriter(), new StringWriter())));
        assertEquals("p2", String.valueOf(JavaScriptProxy.processScript(
                "var projectValue = 'p2'; projectValue;",
                new StringReader(""), new StringWriter(), new StringWriter())));

        BlueSystem.setCurrentBlueData(projectOne);
        assertEquals("p1", String.valueOf(JavaScriptProxy.processScript(
                "projectValue;",
                new StringReader(""), new StringWriter(), new StringWriter())));
    }

    /**
     * Test of processJavascriptInstrument method, of class RhinoProxy.
     */
//    @Test
//    public void testProcessJavascriptInstrument() {
//        System.out.println("processJavascriptInstrument");
//        String script = "";
//        String instrumentId = "";
//        String expResult = "";
//        String result = JavaScriptProxy.processJavascriptInstrument(script, instrumentId);
//        assertEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
}
