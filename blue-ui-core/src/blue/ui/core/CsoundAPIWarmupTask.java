/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.core;

import blue.utility.APIUtilities;
import csnd.Csound;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.logging.Level;
import java.util.logging.Logger;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
public class CsoundAPIWarmupTask implements Runnable {

    @Override
    public void run() {

        System.out.println("CSOUND API WARMUP TASK");
        
        Logger.getLogger("CsoundAPIWarmupTask").log(Level.INFO, "Warming up Csound API");
        
        if(APIUtilities.isCsoundAPIAvailable()) {
            Csound csound = new Csound();
            File f;
            try {

                StringBuilder csd = new StringBuilder();
                csd.append("<CsoundSynthesizer>\n");
                csd.append("<CsInstruments>\n"); 
                csd.append("sr=44100\nksmps=64\nnchnls=2\n");
                csd.append("instr 1\nendin\n");
                csd.append("</CsInstruments>\n"); 
                csd.append("<CsScore>\ni1 0 .01\n</CsScore>\n"); 
                csd.append("</CsoundSynthesizer>\n"); 
                f = File.createTempFile("dummy", ".csd");
                FileOutputStream fos = new FileOutputStream(f);
                fos.write(csd.toString().getBytes()); 
                
                if(csound.Compile(f.getAbsolutePath()) == 0) {
                    csound.Perform();
                }
                csound.Reset();
                csound.delete();
                
            } catch (IOException ex) {
                Exceptions.printStackTrace(ex);
            }
            
        }
    }
     
}
