/*
 * Created on Jul 10, 2003
 *
 * To change the template for this generated file go to
 * Window>Preferences>Java>Code Generation>Code and Comments
 */
package blue.utility;

import blue.orchestra.GenericInstrument;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.util.ArrayList;

/**
 * @author steven
 * 
 * To change the template for this generated type comment go to
 * Window>Preferences>Java>Code Generation>Code and Comments
 */
public class OrchestraUtilities {

    public static ArrayList parseInstruments(File csoundTextFile) {
        ArrayList foundInstruments = null;
        BufferedReader in = null;

        try {
            in = new BufferedReader(new FileReader(csoundTextFile));
            String line = "";
            String iName = "";
            StringBuffer iBody = new StringBuffer();

            foundInstruments = new ArrayList();

            int state = 1;

            while ((line = in.readLine()) != null) {
                switch (state) {
                    case 1:
                        if (line.trim().startsWith("instr")) {
                            int index = line.indexOf(';');
                            if (index != -1) {
                                iName = line.substring(index + 1);
                            }
                            state = 2;
                        }
                        break;
                    case 2:
                        if (line.trim().startsWith("endin")) {
                            GenericInstrument temp = new GenericInstrument();
                            temp.setName(iName);
                            temp.setText(iBody.toString());
                            foundInstruments.add(temp);
                            iName = "";
                            iBody = new StringBuffer();
                            state = 1;
                        } else {
                            iBody.append(line).append("\n");
                        }
                        break;
                }
            }

        } catch (Exception e) {
            System.out.println(blue.BlueSystem
                    .getString("orchestraGUI.error.instrumentParse"));
            System.out.println(e);
            foundInstruments = null;
        } finally {
            if (in != null) {
                try {
                    in.close();
                } catch (IOException e) {
                    System.err.println("Could not close file");
                    e.printStackTrace();
                }
            }
        }

        return foundInstruments;
    }
}
