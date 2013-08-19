/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */

package blue.settings;

import java.io.File;
import java.io.IOException;
import java.text.MessageFormat;
import java.util.Collections;
import java.util.Iterator;
import java.util.StringTokenizer;
import java.util.Vector;

import blue.utilities.ProcessRunner;
import blue.utility.FileUtilities;
import blue.utility.TextUtilities;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

/**
 * 
 * @author steven
 */
public class DriverUtils {

    private static MessageFormat ALSA_MIDI_FORMAT = new MessageFormat(
            "{0} : {1} - {2}");
//
//    public static Vector<CardInfo> getAudioOutputs(String csoundCommand, String driver) {
//
//        if (driver == null) {
//            return null;
//        }
//
//        String driverLow = driver.toLowerCase();
//
//        Vector<CardInfo> vals = new Vector<CardInfo>();
//
//        if (driverLow.equals("pulse")) {
//            vals.add(new PulseAudioCardInfo());
//        } else if (driverLow.equals("alsa")) {
//            File f = new File("/proc/asound/pcm");
//            String values;
//
//            try {
//                values = TextUtilities.getTextFromFile(f);
//                StringTokenizer st = new StringTokenizer(values, "\n");
//
//                while (st.hasMoreTokens()) {
//                    String line = st.nextToken();
//
//                    if (line.indexOf("playback") >= 0) {
//                        String[] parts = line.split(":");
//
//                        String[] cardId = parts[0].split("-");
//
//                        int card = Integer.parseInt(cardId[0]);
//                        int num = Integer.parseInt(cardId[1]);
//
//                        StringBuffer buffer = new StringBuffer();
//                        buffer.append(parts[1]).append(" : ").append(parts[2]);
//
//                        AlsaCardInfo a = new AlsaCardInfo();
//                        a.cardNum = card;
//                        a.portNum = num;
//                        a.description = buffer.toString();
//
//                        vals.add(a);
//                    }
//
//                    Collections.sort((Vector)vals);
//                }
//
//            } catch (IOException ex) {
//                ex.printStackTrace();
//                return null;
//            }
//        } else if (driverLow.equals("jack")) {
//            if (!detectJackPortsWithCsound(csoundCommand, vals, " -o dac:xxx -B4096 ")) {
//                if(!detectJackPortsWithJackLsp(vals, "audio", "input")) {
//                    return null;
//                }
//            }
//        } else {
//
//            String val = TextUtilities
//                    .getTextFromSystemResource(DriverUtils.class, "temp.csd");
//
//            File tempFile = FileUtilities.createTempTextFile("temp", ".csd",
//                    null, val);
//
//            StringBuffer buffer = new StringBuffer();
//
//            buffer.append(csoundCommand);
//            buffer.append(" -+msg_color=false ");
//            buffer.append(" -m1024 ");
//
//            if (driver != null) {
//                buffer.append(" -+rtaudio=").append(driver);
//            }
//
//            buffer.append(" -o dac999 ");
//
//            buffer.append(tempFile.getAbsolutePath());
//
//            ProcessRunner pc = new ProcessRunner();
//            String retVal = null;
//
//            try {
//                pc.execWaitAndCollect(buffer.toString(), null);
//                retVal = pc.getCollectedOutput();
//            } catch (IOException ex) {
//                ex.printStackTrace();
//            }
//
//            if (retVal == null) {
//                return null;
//            }
//
//            String startText = null;
//            String endText = null;
//
//            if (driverLow.equals("portaudio") || driverLow.equals("pa")
//                    || driver.equals("pa_cb") || driver.equals("pa_bl")) {
//                startText = "PortAudio: available";
//                endText = "";
//            } else if (driverLow.equals("winmm") || driverLow.equals("mme")) {
//                startText = "The available output devices are:";
//                endText = "device number is out of range";
//            } else if (driverLow.equals("coreaudio")) {
//                startText = "CoreAudio Module: found";
//                endText = "";
//            }
//
//            if (startText == null || endText == null) {
//                return null;
//            }
//
//            StringTokenizer st = new StringTokenizer(retVal, "\n");
//
//            boolean collect = false;
//
//            while (st.hasMoreTokens()) {
//                String line = st.nextToken().trim();
//
//                if (collect) {
//                    if (endText.length() > 0 && line.indexOf(endText) >= 0) {
//                        collect = false;
//                    } else {
//                        if (driverLow.equals("coreaudio")) {
//                            String coreAudioMatch = "=> CoreAudio device";
//
//                            if (line.indexOf(coreAudioMatch) >= 0) {
//                                try {
//                                    line = line.substring(
//                                            coreAudioMatch.length()).trim();
//
//                                    int cardNum = Integer.parseInt(line
//                                            .substring(0, line.indexOf(":")));
//                                    String desc = line.substring(
//                                            line.indexOf(":") + 1).trim();
//
//                                    CardInfo info = new CardInfo();
//                                    info.cardNum = cardNum;
//                                    info.description = desc;
//
//                                    vals.add(info);
//                                } catch (NumberFormatException nfe) {
//                                    // pass
//                                }
//                            }
//
//                        } else if (line.indexOf(":") >= 0) {
//
//                            try {
//                                int cardNum = Integer.parseInt(line.substring(
//                                        0, line.indexOf(":")));
//                                String desc = line.substring(
//                                        line.indexOf(":") + 1).trim();
//
//                                CardInfo info = new CardInfo();
//                                info.cardNum = cardNum;
//                                info.description = desc;
//
//                                vals.add(info);
//                            } catch (NumberFormatException nfe) {
//                                // pass
//                            }
//                        }
//                    }
//                } else if (line.indexOf(startText) >= 0) {
//                    collect = true;
//
//                }
//
//            }
//        }
//
//        if (vals.size() == 0) {
//            return null;
//        }
//
//        return vals;
//    }
//
//    public static Vector<CardInfo> getAudioInputs(String csoundCommand, String driver) {
//
//        if (driver == null) {
//            return null;
//        }
//
//        String driverLow = driver.toLowerCase();
//
//        Vector vals = new Vector();
//
//        if (driverLow.equals("pulse")) {
//            vals.add(new PulseAudioCardInfo());
//        } else if (driverLow.equals("alsa")) {
//            File f = new File("/proc/asound/pcm");
//            String values;
//
//            try {
//                values = TextUtilities.getTextFromFile(f);
//                StringTokenizer st = new StringTokenizer(values, "\n");
//
//                while (st.hasMoreTokens()) {
//                    String line = st.nextToken();
//
//                    if (line.indexOf("capture") >= 0) {
//                        String[] parts = line.split(":");
//
//                        String[] cardId = parts[0].split("-");
//
//                        int card = Integer.parseInt(cardId[0]);
//                        int num = Integer.parseInt(cardId[1]);
//
//                        StringBuffer buffer = new StringBuffer();
//                        buffer.append(parts[1]).append(" : ").append(parts[2]);
//
//                        AlsaCardInfo a = new AlsaCardInfo();
//                        a.cardNum = card;
//                        a.portNum = num;
//                        a.description = buffer.toString();
//
//                        vals.add(a);
//                    }
//
//                    Collections.sort(vals);
//                }
//
//            } catch (IOException ex) {
//                ex.printStackTrace();
//                return null;
//            }
//        } else if (driverLow.equals("jack")) {
//            if (!detectJackPortsWithCsound(csoundCommand, vals, " -i adc:xxx -B4096 ")) {
//                if (!detectJackPortsWithJackLsp(vals, "audio", "output")) {
//                    return null;
//                }
//            }
//        } else {
//
//            String val = TextUtilities
//                    .getTextFromSystemResource(DriverUtils.class, "temp.csd");
//
//            File tempFile = FileUtilities.createTempTextFile("temp", ".csd",
//                    null, val);
//
//            StringBuffer buffer = new StringBuffer();
//
//            buffer.append(csoundCommand);
//            buffer.append(" -+msg_color=false ");
//
//            if (driver != null) {
//                buffer.append(" -+rtaudio=").append(driver);
//            }
//
//            buffer.append(" -i adc999 ");
//
//            buffer.append(tempFile.getAbsolutePath());
//
//            ProcessRunner pc = new ProcessRunner();
//            String retVal = null;
//
//            try {
//                pc.execWaitAndCollect(buffer.toString(), null);
//                retVal = pc.getCollectedOutput();
//            } catch (IOException ex) {
//                ex.printStackTrace();
//            }
//
//            if (retVal == null) {
//                return null;
//            }
//
//            String startText = null;
//            String endText = null;
//
//            if (driverLow.equals("portaudio") || driverLow.equals("pa")
//                    || driver.equals("pa_cb") || driver.equals("pa_bl")) {
//                startText = "PortAudio: available";
//                endText = "";
//            } else if (driverLow.equals("winmm") || driverLow.equals("mme")) {
//                startText = "The available input devices are:";
//                endText = "device number is out of range";
//            }
//
//            if (startText == null || endText == null) {
//                return null;
//            }
//
//            StringTokenizer st = new StringTokenizer(retVal, "\n");
//
//            boolean collect = false;
//
//            while (st.hasMoreTokens()) {
//                String line = st.nextToken().trim();
//
//                if (collect) {
//
//                    if (endText.length() > 0 && line.indexOf(endText) >= 0) {
//                        collect = false;
//                    } else {
//                        if (driverLow.equals("coreaudio")) {
//                            String coreAudioMatch = "=> CoreAudio device";
//
//                            if (line.indexOf(coreAudioMatch) >= 0) {
//                                try {
//                                    line = line.substring(
//                                            coreAudioMatch.length()).trim();
//
//                                    int cardNum = Integer.parseInt(line
//                                            .substring(0, line.indexOf(":")));
//                                    String desc = line.substring(
//                                            line.indexOf(":") + 1).trim();
//
//                                    CardInfo info = new CardInfo();
//                                    info.cardNum = cardNum;
//                                    info.description = desc;
//
//                                    vals.add(info);
//                                } catch (NumberFormatException nfe) {
//                                    // pass
//                                }
//                            }
//
//                        } else if (line.indexOf(":") >= 0) {
//
//                            try {
//                                int cardNum = Integer.parseInt(line.substring(
//                                        0, line.indexOf(":")));
//                                String desc = line.substring(
//                                        line.indexOf(":") + 1).trim();
//
//                                CardInfo info = new CardInfo();
//                                info.cardNum = cardNum;
//                                info.description = desc;
//
//                                vals.add(info);
//                            } catch (NumberFormatException nfe) {
//                                // pass
//                            }
//                        }
//                    }
//                } else if (line.indexOf(startText) >= 0) {
//                    collect = true;
//
//                }
//
//            }
//
//        }
//
//        if (vals.size() == 0) {
//            return null;
//        }
//
//        return vals;
//    }

    public static Vector getMIDIOutputs(String csoundCommand, String driver) {

        if (driver == null) {
            return null;
        }

        String driverLow = driver.toLowerCase();

        Vector vals = new Vector();

        if (driverLow.equals("alsa")) {
            File f = new File("/proc/asound/seq/clients");
            String values;

            try {
                values = TextUtilities.getTextFromFile(f);
                String[] lines = values.split("\n");

                for (int i = 0; i < lines.length; i++) {
                    String line = lines[i].trim();

                    if (line.startsWith("Client") && line.indexOf(":") >= 0) {

                        String[] parts = line.split("\"");
                        String clientName = parts[1];
                        String clientType = parts[2].substring(1);
                        int clientNum = Integer.parseInt(line.substring(7,
                                line.indexOf(":")).trim());

                        while (i < lines.length - 2) {
                            i++;

                            String tempLine = lines[i].trim();
                            if (tempLine.startsWith("Port")) {

                                String capabilities = tempLine
                                        .substring(tempLine.lastIndexOf("("));

                                if (capabilities.indexOf("W") >= 0) {

                                    String[] portParts = tempLine.split("\"");

                                    int portNum = Integer
                                            .parseInt(tempLine.substring(5,
                                                    tempLine.indexOf(":"))
                                                    .trim());
                                    String portName = portParts[1];

                                    Object[] nameArgs = { clientName, portName,
                                            clientType };

                                    AlsaCardInfo a = new AlsaCardInfo();
                                    a.cardNum = clientNum;
                                    a.portNum = portNum;
                                    a.description = ALSA_MIDI_FORMAT
                                            .format(nameArgs);

                                    vals.add(a);
                                }
                            } else if (tempLine.startsWith("Client")) {
                                i--;
                                break;
                            }
                        }

                    }

                    Collections.sort(vals);
                }
            } catch (Exception ex) {
                ex.printStackTrace();
                return null;
            }
        } else {

            String val = TextUtilities
                    .getTextFromSystemResource(DriverUtils.class, "temp.csd");

            File tempFile = FileUtilities.createTempTextFile("temp", ".csd",
                    null, val);

            StringBuffer buffer = new StringBuffer();

            buffer.append(csoundCommand);
            buffer.append(" -+msg_color=false ");

            if (driver != null) {
                buffer.append(" -+rtaudio=").append(driver);
            }

            // if(driver.equals("jack")) {
            // buffer.append("-Q 999");
            // } else {
            buffer.append(" -Q 999 ");
            // }

            buffer.append(tempFile.getAbsolutePath());

            ProcessRunner pc = new ProcessRunner();
            String retVal = null;

            try {
                pc.execWaitAndCollect(buffer.toString(), null);
                retVal = pc.getCollectedOutput();
            } catch (IOException ex) {
                ex.printStackTrace();
            }

            if (retVal == null) {
                return null;
            }

            String startText = null;
            String endText = null;

            if (driverLow.equals("portmidi") || driverLow.equals("pm")) {
                startText = "The available MIDI";
                endText = "";
            } else if (driverLow.equals("winmm") || driverLow.equals("mme")) {
                startText = "The available MIDI";
                endText = "rtmidi: output device number is out of range";
            }

            if (startText == null || endText == null) {
                return null;
            }

            StringTokenizer st = new StringTokenizer(retVal, "\n");

            boolean collect = false;

            while (st.hasMoreTokens()) {
                String line = st.nextToken().trim();

                if (collect) {
                    if (endText.length() > 0 && line.indexOf(endText) >= 0) {
                        collect = false;
                    } else if (line.indexOf(":") >= 0) {

                        try {
                            int cardNum = Integer.parseInt(line.substring(0,
                                    line.indexOf(":")));
                            String desc = line.substring(line.indexOf(":") + 1)
                                    .trim();

                            CardInfo info = new CardInfo();
                            info.cardNum = cardNum;
                            info.description = desc;

                            vals.add(info);
                        } catch (NumberFormatException nfe) {
                            // pass
                        }
                    }
                } else if (line.indexOf(startText) >= 0) {
                    collect = true;

                }

            }
        }

        if (vals.size() == 0) {
            return null;
        }

        return vals;
    }

    public static Vector getMIDIInputs(String csoundCommand, String driver) {

        if (driver == null) {
            return null;
        }

        String driverLow = driver.toLowerCase();

        Vector vals = new Vector();

        if (driverLow.equals("alsa")) {
            File f = new File("/proc/asound/seq/clients");
            String values;

            try {
                values = TextUtilities.getTextFromFile(f);
                String[] lines = values.split("\n");

                for (int i = 0; i < lines.length; i++) {
                    String line = lines[i].trim();

                    if (line.startsWith("Client") && line.indexOf(":") >= 0) {

                        String[] parts = line.split("\"");
                        String clientName = parts[1];
                        String clientType = parts[2].substring(1);
                        int clientNum = Integer.parseInt(line.substring(7,
                                line.indexOf(":")).trim());

                        while (i < lines.length - 2) {
                            i++;

                            String tempLine = lines[i].trim();
                            if (tempLine.startsWith("Port")) {

                                String capabilities = tempLine
                                        .substring(tempLine.lastIndexOf("("));

                                if (capabilities.indexOf("R") >= 0) {

                                    String[] portParts = tempLine.split("\"");

                                    int portNum = Integer
                                            .parseInt(tempLine.substring(5,
                                                    tempLine.indexOf(":"))
                                                    .trim());
                                    String portName = portParts[1];

                                    Object[] nameArgs = { clientName, portName,
                                            clientType };

                                    AlsaCardInfo a = new AlsaCardInfo();
                                    a.cardNum = clientNum;
                                    a.portNum = portNum;
                                    a.description = ALSA_MIDI_FORMAT
                                            .format(nameArgs);

                                    vals.add(a);
                                }
                            } else if (tempLine.startsWith("Client")) {
                                i--;
                                break;
                            }
                        }

                    }

                    Collections.sort(vals);
                }
            } catch (Exception ex) {
                ex.printStackTrace();
                return null;
            }
        } else {

            String val = TextUtilities
                    .getTextFromSystemResource(DriverUtils.class, "temp.csd");

            File tempFile = FileUtilities.createTempTextFile("temp", ".csd",
                    null, val);

            StringBuffer buffer = new StringBuffer();

            buffer.append(csoundCommand);
            buffer.append(" -+msg_color=false ");

            if (driver != null) {
                buffer.append(" -+rtmidi=").append(driver);
            }

            // if(driver.equals("jack")) {
            // buffer.append("-M dc");
            // } else {
            buffer.append(" -M 999 ");
            // }

            buffer.append(tempFile.getAbsolutePath());

            ProcessRunner pc = new ProcessRunner();
            String retVal = null;

            try {
                pc.execWaitAndCollect(buffer.toString(), null);
                retVal = pc.getCollectedOutput();
            } catch (IOException ex) {
                ex.printStackTrace();
            }

            if (retVal == null) {
                return null;
            }

            String startText = null;
            String endText = null;

            if (driverLow.equals("portmidi") || driverLow.equals("pm")) {
                startText = "The available MIDI";
                endText = "";
            } else if (driverLow.equals("winmm") || driverLow.equals("mme")) {
                startText = "The available MIDI";
                endText = "rtmidi: input device number is out of range";
            }

            if (startText == null || endText == null) {
                return null;
            }

            StringTokenizer st = new StringTokenizer(retVal, "\n");

            boolean collect = false;

            while (st.hasMoreTokens()) {
                String line = st.nextToken().trim();

                if (collect) {
                    if (endText.length() > 0 && line.indexOf(endText) >= 0) {
                        collect = false;
                    } else if (line.indexOf(":") >= 0) {

                        try {
                            int cardNum = Integer.parseInt(line.substring(0,
                                    line.indexOf(":")));
                            String desc = line.substring(line.indexOf(":") + 1)
                                    .trim();

                            CardInfo info = new CardInfo();
                            info.cardNum = cardNum;
                            info.description = desc;

                            vals.add(info);
                        } catch (NumberFormatException nfe) {
                            // pass
                        }
                    }
                } else if (line.indexOf(startText) >= 0) {
                    collect = true;

                }

            }
        }

        if (vals.size() == 0) {
            return null;
        }

        return vals;
    }

//    public static void main(String args[]) {
//
//        Vector cards;
//
//        // cards = DriverUtils.getAudioOutputs("portaudio");
//        //
//        // for (Iterator it = cards.iterator(); it.hasNext();) {
//        // System.out.println(it.next());
//        // }
//        //
//        // System.out.println("---");
//        //
//        // cards = DriverUtils.getAudioOutputs("alsa");
//        //
//        // for (Iterator it = cards.iterator(); it.hasNext();) {
//        // System.out.println(it.next());
//        // }
//        //
//        // System.out.println("---");
//        //
//        // cards = DriverUtils.getAudioInputs("alsa");
//        //
//        // for (Iterator it = cards.iterator(); it.hasNext();) {
//        // System.out.println(it.next());
//        // }
//        //
//        // System.out.println("---");
//
//        // cards = DriverUtils.getMIDIInputs("alsa");
//        //
//        // for (Iterator it = cards.iterator(); it.hasNext();) {
//        // System.out.println(it.next());
//        // }
//        //
//        // System.out.println("---");
//        //
//        // cards = DriverUtils.getMIDIOutputs("alsa");
//        //
//        // for (Iterator it = cards.iterator(); it.hasNext();) {
//        // System.out.println(it.next());
//        // }
//
//        // System.out.println("---");
//
//        cards = DriverUtils.getAudioOutputs("csound", "jack");
//
//        for (Iterator it = cards.iterator(); it.hasNext();) {
//            System.out.println(it.next());
//        }
//
//    }
    
    public static String findExecutableInPath(String exe, String[] paths) {
        for(String p : paths) {
            System.out.println(new File(p + File.separator + exe));
            if(new File(p + File.separator + exe).exists()) {
                return p + File.separator + exe;
            }
        }
        return null;
    }

    public static boolean detectJackPortsWithJackLsp(Vector vals, String portType, String subType) {
        
        ProcessRunner pc = new ProcessRunner();
        String retVal = null;
        
        String path = System.getenv("PATH");
        
        if(!File.pathSeparator.equals(";")) {
            path += File.pathSeparator + "/usr/local/bin";
        }
        
        String[] paths = path.split(File.pathSeparator);
        
        String jackLspPath = findExecutableInPath("jack_lsp", paths);

        if(jackLspPath == null || jackLspPath.length() == 0) {
            return false;
        }
        
        try {
            pc.execWaitAndCollect(jackLspPath + " -t -p", null);
            retVal = pc.getCollectedOutput();
        } catch (IOException ex) {
            ex.printStackTrace();
        }
        
        if(retVal == null || retVal.length() == 0) {
            return false;
        }
        parseJackLspOutput(retVal, portType, subType, vals);
        
        return true;
    }
    
    public static boolean detectJackPortsWithCsound(String csoundCommand, Vector vals, String commandlineArg) {
        String jackCSD = TextUtilities
                           .getTextFromSystemResource(DriverUtils.class, "tempJack.csd");
        StringBuffer buffer = new StringBuffer();
        buffer.append(csoundCommand);
        buffer.append(" -+msg_color=false -+rtaudio=jack");
        buffer.append(commandlineArg);
        String retVal = null;
        // INITIAL RUN TO FIND OUT TRUE SRATE
        String tempText = jackCSD.replaceAll("\\$SR", "1000");
        File tempFile = FileUtilities.createTempTextFile("temp", ".csd",
                null, tempText);
        String command = buffer.toString() + tempFile.getAbsolutePath();
        ProcessRunner pc = new ProcessRunner();
        try {
            pc.execWaitAndCollect(command, null);
            retVal = pc.getCollectedOutput();
        } catch (IOException ex) {
            ex.printStackTrace();
        }
        String sr = null;
        if (retVal != null
                && retVal.indexOf("does not match JACK sample rate") >= 0) {
            String[] lines = retVal.split("\n");

            for (int i = 0; i < lines.length; i++) {
                String line = lines[i];

                if (line.indexOf("does not match JACK sample rate") >= 0) {
                    sr = line.substring(line.lastIndexOf(" ") + 1);
                    break;
                }
            }
        } else {
            // MIGHT WANT TO GIVE MESSAGE SAYING COULD NOT CONNECT TO JACK
            return false;
        }
        if (sr == null) {
            return false;
        }
        tempText = jackCSD.replaceAll("\\$SR", sr);
        tempFile = FileUtilities.createTempTextFile("temp", ".csd", null,
                tempText);
        command = buffer.toString() + tempFile.getAbsolutePath();
        try {
            pc.execWaitAndCollect(command, null);
            retVal = pc.getCollectedOutput();
        } catch (IOException ex) {
            ex.printStackTrace();
        }
        if (retVal == null) {
            return false;
        }
        // Find Devices
        StringTokenizer st = new StringTokenizer(retVal, "\n");
        while (st.hasMoreTokens()) {
            String line = st.nextToken().trim();

            if (line.endsWith("channel)") || line.endsWith("channels)")) {
                String deviceName = line.substring(1, line
                        .lastIndexOf("\""));
                String description = deviceName + " "
                        + line.substring(line.indexOf("("));

                JackCardInfo cardInfo = new JackCardInfo();
                cardInfo.deviceName = deviceName;
                cardInfo.description = description;

                vals.add(cardInfo);
            }
        }
        return true;
    }

    protected static void parseJackLspOutput(String output, String portType, String subType, Vector vals) throws NumberFormatException {
        //        System.out.println(retVal);
                
                String[] lines = output.split("\\n");
                ArrayList<String> ports = new ArrayList<>();
                Map<String, Integer> portMap = new HashMap<>();
                
                for(int i = 0; i < lines.length; i += 3) {
                    if(lines[i + 2].contains(portType) && 
                            lines[i + 1].contains(subType)) {
                        String port = lines[i].trim();
                        int end = port.length() - 1;
                        while(end >= 0 && Character.isDigit(port.charAt(end))) {
                            end--;
                        }
                        end++;
                        
                        String portName = port.substring(0, end);
                        String chn = port.substring(end);
                        
                        if(portMap.containsKey(portName)) {
                            int p = portMap.get(portName);
                            if(p < new Integer(chn)) {
                                portMap.put(portName, new Integer(chn));
                            }
                        } else {
                            portMap.put(portName, new Integer(chn));
                        }
                    }
                }
                
                for(Map.Entry<String, Integer> entry : portMap.entrySet()) {
                    JackCardInfo cardInfo = new JackCardInfo();
                    cardInfo.deviceName = entry.getKey();
                    
                    if(entry.getValue().intValue() == 1) {
                        cardInfo.description = cardInfo.deviceName + " (1 channel)";
                    } else {
                        cardInfo.description = cardInfo.deviceName + " (" + entry.getValue().intValue() + " channels)";
                    }
                    vals.add(cardInfo);
                }
    }

    public static class CardInfo {
        int cardNum = 0;

        String description = "";

        public String toString() {
            return cardNum + ") " + description;
        }

        public String getDacString() {
            return "dac" + cardNum;
        }

        public String getAdcString() {
            return "adc" + cardNum;
        }

        public String getMIDIString() {
            return Integer.toString(cardNum);
        }
    }

    public static class PulseAudioCardInfo extends CardInfo {
         public String toString() {
            return "PulseAudio";
        }

        public String getDacString() {
            return "dac";
        }

        public String getAdcString() {
            return "adc";
        }

        public String getMIDIString() {
            return "";
        }
    }

    public static class AlsaCardInfo extends CardInfo implements Comparable<AlsaCardInfo> {

        int portNum = 0;

        public String toString() {
            StringBuffer buffer = new StringBuffer();
            buffer.append("(").append(cardNum).append(":").append(portNum)
                    .append(") ");
            buffer.append(description);

            return buffer.toString();
        }

        public String getDacString() {
            StringBuffer buffer = new StringBuffer();
            buffer.append("dac:hw:").append(cardNum).append(",")
                    .append(portNum);
            return buffer.toString();
        }

        public String getAdcString() {
            StringBuffer buffer = new StringBuffer();
            buffer.append("adc:hw:").append(cardNum).append(",")
                    .append(portNum);
            return buffer.toString();
        }

        public String getMIDIString() {
            StringBuffer buffer = new StringBuffer();
            buffer.append("hw:").append(cardNum).append(",").append(portNum);
            return buffer.toString();
        }

        public int compareTo(AlsaCardInfo o) {
            AlsaCardInfo b = (AlsaCardInfo) o;

            if (b.cardNum != this.cardNum) {
                return this.cardNum - b.cardNum;
            }

            if (b.portNum != this.portNum) {
                return this.portNum - b.portNum;
            }

            return 0;
        }

    }

    public static class JackCardInfo extends CardInfo {
        String description = "";

        String deviceName = "";

        public String toString() {
            return description;
        }

        public String getDacString() {
            return "dac:" + deviceName;
        }

        public String getAdcString() {
            return "adc:" + deviceName;
        }

        public String getMIDIString() {
            return "";
        }
    }

}
