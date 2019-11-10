/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2003 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as
 published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU Library General Public
 License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.tools.soundFont;

import blue.settings.UtilitySettings;
import blue.ui.core.render.DiskRenderManager;
import blue.utility.FileUtilities;
import blue.utility.TextUtilities;
import java.io.File;
import java.util.StringTokenizer;

/**
 * @author Steven yi
 *
 */
public class SoundFontUtility {

    private static String templateCSD = null;

    static {
        templateCSD = "<CsoundSynthesizer>\n";
        templateCSD += "<CsInstruments>\n";
        templateCSD += "sr = 44100\n";
        templateCSD += "kr = 441\n";
        templateCSD += "ksmps = 100\n";
        templateCSD += "nchnls = 2\n";
        templateCSD += "gi_sf	sfload	\"$filename\"\n";
        templateCSD += "sfilist gi_sf\n";
        templateCSD += "sfplist gi_sf\n";
        templateCSD += "instr 1\n";
        templateCSD += "endin\n";
        templateCSD += "</CsInstruments>\n";
        templateCSD += "<CsScore>\n";
        templateCSD += "e\n";
        templateCSD += "</CsScore>\n";
        templateCSD += "</CsoundSynthesizer>";

    }

    private static String getTemplateCSD() {
        return templateCSD;
    }

    private static String getInstrumentList(String csoundOutput) {
        StringTokenizer st = new StringTokenizer(csoundOutput, "\n");
        StringBuffer buffer = new StringBuffer();
        String line;

        int mode = 0;

        while (st.hasMoreTokens() && mode != 2) {
            line = st.nextToken();

            switch (mode) {
                case 0:
                    if (line.startsWith("Instrument list")) {
                        mode = 1;
                    }
                    break;
                case 1:
                    if (line.indexOf(')') == -1
                            || line.startsWith("Preset list")) {
                        mode = 2;
                    } else {
                        buffer.append(line).append("\n");
                    }
                    break;
            }
        }

        return buffer.toString();
    }

    private static String getPresetList(String csoundOutput) {
        StringTokenizer st = new StringTokenizer(csoundOutput, "\n");
        StringBuffer buffer = new StringBuffer();
        String line;

        int mode = 0;

        while (st.hasMoreTokens() && mode != 2) {
            line = st.nextToken();

            switch (mode) {
                case 0:
                    if (line.startsWith("Preset list")) {
                        mode = 1;
                    }
                    break;
                case 1:
                    if (line.indexOf(')') == -1) {
                        mode = 2;
                    } else {
                        buffer.append(line).append("\n");
                    }
                    break;
            }
        }

        return buffer.toString();
    }

    public static SoundFontInfo getSoundFontInfo(String fileName) {
        String cleanName = fileName.replace('\\', '/');
        String tempCSD = SoundFontUtility.getTemplateCSD();

        tempCSD = TextUtilities.replace(tempCSD, "$filename", cleanName);

        File temp = FileUtilities.createTempTextFile("tempCsd", ".csd", null,
                tempCSD);

        String osName = System.getProperty("os.name");

        String command = UtilitySettings.getInstance().csoundExecutable;
        String[] args = new String[]{command, temp.getAbsolutePath()};

        String csoundOutput = DiskRenderManager.getInstance()
                .execWaitAndCollect(args, null);


           // FIXME - remove commented out code 
//        if (APIUtilities.isCsoundAPIAvailable() && 
//                GeneralSettings.getInstance().isUsingCsoundAPI()) {
//
//            String[] args = command.split("\\s+");
//                               
//            String[] args2 = new String[args.length + 1];
//            System.arraycopy(args, 0, args2, 0, args.length);
//            args2[args.length] = temp.getAbsolutePath();
//                            
//            APIDiskRenderer renderer = new APIDiskRenderer();
//            csoundOutput = renderer.execWaitAndCollect(args2, null);
//        } else {
//            
//            try {
//                command += " \"" + temp.getAbsolutePath() + "\"";
//                
//                ProcessRunner p = new ProcessRunner();
//                p.execWaitAndCollect(command, null);
//                csoundOutput = p.getCollectedOutput();
//    
//            } catch (Exception e) {
//                e.printStackTrace();
//                return null;
//            }
//        }

        String instrumentList = getInstrumentList(csoundOutput);
        String presetList = getPresetList(csoundOutput);

        SoundFontInfo info = new SoundFontInfo(instrumentList, presetList);

        return info;
    }

    public static void main(String[] args) {
        SoundFontInfo info = getSoundFontInfo(
                "c:\\csound\\samples\\sf2\\Chinese Flute Zhudi Analog (906KB).sf2");

        System.out.println(info.instrumentList);
        System.out.println(info.presetList);
    }
}
