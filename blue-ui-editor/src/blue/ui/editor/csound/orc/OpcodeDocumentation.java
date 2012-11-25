/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.editor.csound.orc;

import java.io.BufferedReader;
import java.io.FileReader;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
public class OpcodeDocumentation {
    public static String getOpcodeDocumentation(String opcodeName) {
        StringBuffer buffer = new StringBuffer();
        String filename = "/Users/stevenyi/work/csound/manual/html/" + opcodeName + ".html";

        boolean appending = false;
        
        buffer.append("<html>");
        
        try {
            BufferedReader br = new BufferedReader(new FileReader(
                    filename));
            String line;
            while ((line = br.readLine().trim()) != null) {
                if(appending) {
                    if(line.startsWith("<div class=\"navfooter\">")) {
                        break;
                    }
                    buffer.append(line).append("\n");
                } else {
                    if(line.startsWith("<div class=\"refentry\"")) {
                        
                        buffer.append(line).append("\n");
                    } else if(line.startsWith("<div class=\"refnamediv\">")) {
                        appending = true;
                        buffer.append(line).append("\n");
                    }
                }
            }

            br.close();
        } catch (Exception ex) {
            Exceptions.printStackTrace(ex);
        }
        
        buffer.append("</html>");

        return buffer.toString();   
    }
}
