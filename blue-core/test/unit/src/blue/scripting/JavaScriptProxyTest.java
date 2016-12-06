/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.scripting;

import org.junit.*;
import static org.junit.Assert.assertEquals;

/**
 *
 * @author stevenyi
 */
public class JavaScriptProxyTest {
    
    public JavaScriptProxyTest() {
    }

    @BeforeClass
    public static void setUpClass() throws Exception {
    }

    @AfterClass
    public static void tearDownClass() throws Exception {
    }
    
    @Before
    public void setUp() {
    }
    
    @After
    public void tearDown() {
    }

    /**
     * Test of processJavascriptScore method, of class JavaScriptProxy.
     */
    @Test
    public void testProcessJavascriptScore() {
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
