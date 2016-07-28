/*
 * blue - object composition environment for csound
 * Copyright (C) 2013
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.settings;

import blue.services.render.DeviceInfo;
import blue.services.render.DiskRenderService;
import blue.utilities.ProcessRunner;
import blue.utility.FileUtilities;
import blue.utility.TextUtilities;
import java.io.File;
import java.io.IOException;
import java.text.MessageFormat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.StringTokenizer;

/**
 *
 * @author stevenyi
 */
public class DriverUtilities {

    private static MessageFormat ALSA_MIDI_FORMAT = new MessageFormat(
            "{0} : {1} - {2}");

    public static List<DeviceInfo> getAudioDevices(String csoundCommand,
            String driver, DiskRenderService service, boolean isInput) {

        if (driver == null || csoundCommand == null || service == null) {
            return null;
        }

        List<DeviceInfo> devices = null;

        String driverLow = driver.toLowerCase().trim();

        switch (driverLow) {
            case "pulse":
                devices = getAudioDevicesPulse(isInput);
                break;

            case "alsa":
                devices = getAudioDevicesAlsa(isInput);
                break;

            case "jack":
                devices = getAudioDevicesJack(csoundCommand, service, isInput);
                break;

            case "portaudio":
            case "pa":
            case "pa_cb":
            case "pa_bl":
            case "winmm":
            case "mme":
            case "coreaudio":
            case "auhal":
                devices = getAudioDevicesGeneric(csoundCommand, driver,
                        service,
                        isInput);
                break;

            default:
                devices = null;

        }

        return devices;
    }

    public static List<DeviceInfo> getMidiDevices(String csoundCommand,
            String driver, DiskRenderService service, boolean isInput) {

        List<DeviceInfo> devices;
        String driverLow = driver.toLowerCase().trim();
        
        if("alsa".equals(driverLow)) {
            devices = getMidiDevicesAlsa(isInput);
        } else {
            devices = getMidiDevicesGeneric(csoundCommand, driver, service,
                    isInput);
        }

        return devices;
    }

    /* MIDI DEVICE LISTING METHODS */
    protected static List<DeviceInfo> getMidiDevicesAlsa(boolean isInput) {

        List<DeviceInfo> devices = new ArrayList<>();

        String portType = isInput ? "R" : "W";

        File f = new File("/proc/asound/seq/clients");
        String values;

        try {
            values = TextUtilities.getTextFromFile(f);
            String[] lines = values.split("\\r?\\n");

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

                            if (capabilities.indexOf(portType) >= 0) {

                                String[] portParts = tempLine.split("\"");

                                int portNum = Integer
                                        .parseInt(tempLine.substring(5,
                                        tempLine.indexOf(":"))
                                        .trim());
                                String portName = portParts[1];

                                Object[] nameArgs = {clientName, portName,
                                    clientType};


                                String deviceId = String.format("hw:%d,%d",
                                        clientNum, portNum);

                                devices.add(new DeviceInfo(
                                        ALSA_MIDI_FORMAT.format(nameArgs), 
                                        deviceId));
                            }
                        } else if (tempLine.startsWith("Client")) {
                            i--;
                            break;
                        }
                    }

                }
            }
        } catch (IOException | NumberFormatException ex) {
//            ex.printStackTrace();
            return null;
        }
        return devices;
    }


    protected static List<DeviceInfo> getMidiDevicesGeneric(String csoundCommand,
            String driver, DiskRenderService service, boolean isInput) {

        int csVersion = service.getCsoundVersion(csoundCommand);
        if (csVersion < 5) {
            return null;
        }

        String output = getCsoundMidiOutput(csoundCommand, driver, service, isInput);
        return parseCsoundMidiOutput(output, isInput);
    }


    protected static String getCsoundMidiOutput(String csoundCommand, String driver,
            DiskRenderService service, boolean isInput) {
        String val = TextUtilities
                .getTextFromSystemResource(DriverUtilities.class, "temp.csd");

        File tempFile = FileUtilities.createTempTextFile("temp", ".csd",
                null, val);

        String ioFlag = isInput ? "-M999" : "-M999";

        String args[] = new String[]{
            csoundCommand,
            ioFlag, "-+msg_color=false",
            "-+rtmidi=" + driver, "-m1024", tempFile.getAbsolutePath()
        };

        return service.execWaitAndCollect(args, null);
    }

    protected static List<DeviceInfo> parseCsoundMidiOutput(String text, boolean isInput) {
        List<DeviceInfo> devices = new ArrayList<>();
        boolean collect = false;
        String startToken = "sorting score";
        String endToken = "***";

        String lines[] = text.split("\\r?\\n");
        for (String line : lines) {
            if (collect) {
                if (endToken.length() > 0 && line.indexOf(endToken) >= 0) {
                    collect = false;
                } else if (line.indexOf(":") >= 0) {
                    try {
                        int cardNum = Integer.parseInt(line.substring(0,
                                line.indexOf(":")).trim());
                        String desc = line.substring(line.indexOf(":") + 1)
                                .trim();

                        devices.add(new DeviceInfo(desc, Integer.toString(cardNum)));
                    } catch (NumberFormatException nfe) {
                        // pass
                    }
                }
            } else if (line.toLowerCase().indexOf(startToken) >= 0) {
                collect = true;
            }
        }

        return devices;
    }
    
    /* AUDIO DEVICE LISTING METHODS */
    // PULSE AUDIO
    protected static List<DeviceInfo> getAudioDevicesPulse(boolean isInput) {
        List<DeviceInfo> devices = new ArrayList<>();
        if (isInput) {
            devices.add(new DeviceInfo("PulseAudio", "adc"));
        } else {
            devices.add(new DeviceInfo("PulseAudio", "dac"));
        }
        return devices;
    }

    protected static List<DeviceInfo> getAudioDevicesAlsa(boolean isInput) {

        List<DeviceInfo> devices = new ArrayList<>();

        String searchVal = isInput ? "capture" : "playback";
        String prepend = isInput ? "adc:hw:" : "dac:hw:";


        File f = new File("/proc/asound/pcm");
        String values;

        try {
            values = TextUtilities.getTextFromFile(f);
            StringTokenizer st = new StringTokenizer(values, "\n");

            while (st.hasMoreTokens()) {
                String line = st.nextToken();

                if (line.indexOf(searchVal) >= 0) {
                    String[] parts = line.split(":");

                    String[] cardId = parts[0].split("-");

                    int card = Integer.parseInt(cardId[0]);
                    int num = Integer.parseInt(cardId[1]);

                    String displayName = String.format("(%d:%d) %s : %s",
                            card, num, parts[1], parts[2]);
                    String deviceId = String.format("%s%d:%d", prepend, card,
                            num);

                    DeviceInfo info = new DeviceInfo(displayName, deviceId);
                    devices.add(info);
                }

            }
        } catch (IOException ex) {
            ex.printStackTrace();
            return null;
        }
        return devices;
    }

    protected static List<DeviceInfo> getAudioDevicesJack(String csoundCommand,
            DiskRenderService service, boolean isInput) {
        List<DeviceInfo> retVal = getAudioDevicesJackCsound(csoundCommand,
                service, isInput);
        if (retVal == null || retVal.size() == 0) {
            retVal = getAudioDevicesJackLsp(isInput);
        }
        return retVal;
    }

    protected static List<DeviceInfo> getAudioDevicesGeneric(String csoundCommand,
            String driver, DiskRenderService service, boolean isInput) {

        int csVersion = service.getCsoundVersion(csoundCommand);
        if (csVersion < 5) {
            return null;
        }

        String output = getCsoundOutput(csoundCommand, driver, service, isInput);
        return parseCsoundOutput(output, isInput);
    }

    /**
     * UTILITY METHODS
     */
    protected static List<DeviceInfo> parseCsoundOutput(String text, boolean isInput) {
        List<DeviceInfo> devices = new ArrayList<>();
        boolean collect = false;
        String prepend = isInput ? "adc" : "dac";
        String startToken = "audio buffered in";
        String endToken = "inactive allocs";

        String lines[] = text.split("\\r?\\n");
        for (String line : lines) {
            if (collect) {
                if (endToken.length() > 0 && line.indexOf(endToken) >= 0) {
                    collect = false;
                } else if (line.indexOf(":") >= 0) {
                    try {
                        int cardNum = Integer.parseInt(line.substring(0,
                                line.indexOf(":")).trim());
                        String desc = line.substring(line.indexOf(":") + 1)
                                .trim();

                        devices.add(new DeviceInfo(desc, prepend + cardNum));
                    } catch (NumberFormatException nfe) {
                        // pass
                    }
                }
            } else if (line.indexOf(startToken) >= 0) {
                collect = true;
            }
        }

        return devices;
    }

    protected static String getCsoundOutput(String csoundCommand, String driver,
            DiskRenderService service, boolean isInput) {
        String val = TextUtilities
                .getTextFromSystemResource(DriverUtilities.class, "temp.csd");

        File tempFile = FileUtilities.createTempTextFile("temp", ".csd",
                null, val);

        String ioFlag = isInput ? "-iadc999" : "-odac999";

        String args[] = new String[]{
            csoundCommand,
            ioFlag, "-+msg_color=false",
            "-+rtaudio=" + driver, "-m1024", tempFile.getAbsolutePath()
        };

        return service.execWaitAndCollect(args, null);
    }

    protected static List<DeviceInfo> getAudioDevicesJackCsound(String csoundCommand,
            DiskRenderService service,
            boolean isInput) {

        int csVersion = service.getCsoundVersion(csoundCommand);
        if (csVersion < 5) {
            return null;
        }

        List<DeviceInfo> devices = new ArrayList<>();

        String jackCSD = TextUtilities
                .getTextFromSystemResource(DriverUtilities.class, "tempJack.csd");

        String retVal = null;
        // INITIAL RUN TO FIND OUT TRUE SRATE
        String tempText = jackCSD.replaceAll("\\$SR", "1000");
        File tempFile = FileUtilities.createTempTextFile("temp", ".csd",
                null, tempText);

        String ioFlag = isInput ? "-iadc:xxx" : "-odac:xxx";

        String args[] = new String[]{
            csoundCommand,
            ioFlag, "-B4096",
            "-+msg_color=false", "-+rtaudio=jack", tempFile.getAbsolutePath()
        };

        retVal = service.execWaitAndCollect(args, null);

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
            return null;
        }
        if (sr == null) {
            return null;
        }
        tempText = jackCSD.replaceAll("\\$SR", sr);
        tempFile = FileUtilities.createTempTextFile("temp", ".csd", null,
                tempText);

        args[args.length - 1] = tempFile.getAbsolutePath();

        retVal = service.execWaitAndCollect(args, null);

        if (retVal == null) {
            return null;
        }


        // Find Devices
        if (csVersion == 5) {
            StringTokenizer st = new StringTokenizer(retVal, "\n");
            String prepend = isInput ? "adc:" : "dac:";

            while (st.hasMoreTokens()) {
                String line = st.nextToken().trim();

                if (line.endsWith("channel)") || line.endsWith("channels)")) {
                    String deviceName = prepend + line.substring(1, line
                            .lastIndexOf("\""));
                    String description = deviceName + " "
                            + line.substring(line.indexOf("("));

                    DeviceInfo info = new DeviceInfo(description, deviceName);
                    devices.add(info);
                }
            }
        } else {
            List<DeviceInfo> temp = parseCsoundOutput(retVal, isInput);
            for (DeviceInfo info : temp) {
                String parts[] = info.toString().split("\\s+");
                devices.add(new DeviceInfo(
                        info.toString(),
                        parts[0]));
            }
        }

        return devices;
    }

    protected static List<DeviceInfo> getAudioDevicesJackLsp(boolean isInput) {
        List<DeviceInfo> devices = new ArrayList<>();
        ProcessRunner pc = new ProcessRunner();
        String retVal = null;
        String portType = "audio";
        String subType = isInput ? "output" : "input";
        String prepend = isInput ? "adc:" : "dac:";

        String path = System.getenv("PATH");

        if (!File.pathSeparator.equals(";")) {
            path += File.pathSeparator + "/usr/local/bin";
        }

        String[] paths = path.split(File.pathSeparator);

        String jackLspPath = findExecutableInPath("jack_lsp", paths);

        if (jackLspPath == null || jackLspPath.length() == 0) {
            return null;
        }


        try {
            pc.execWaitAndCollect(jackLspPath + " -t -p", null);
            retVal = pc.getCollectedOutput();
        } catch (IOException ex) {
            ex.printStackTrace();
        }

        if (retVal == null || retVal.length() == 0) {
            return null;
        }
        parseJackLspOutput(retVal, portType, subType, prepend, devices);

        return devices;

    }

    protected static void parseJackLspOutput(String output, String portType,
            String subType, String prepend, List<DeviceInfo> vals)
            throws NumberFormatException {
        //        System.out.println(retVal);

        String[] lines = output.split("\\n");
        ArrayList<String> ports = new ArrayList<>();
        Map<String, Integer> portMap = new HashMap<>();

        for (int i = 0; i < lines.length; i += 3) {
            if (lines[i + 2].contains(portType)
                    && lines[i + 1].contains(subType)) {
                String port = lines[i].trim();
                int end = port.length() - 1;
                while (end >= 0 && Character.isDigit(port.charAt(end))) {
                    end--;
                }
                end++;

                String portName = port.substring(0, end);
                String chn = port.substring(end);

                if (portMap.containsKey(portName)) {
                    int p = portMap.get(portName);
                    if (p < new Integer(chn)) {
                        portMap.put(portName, new Integer(chn));
                    }
                } else {
                    portMap.put(portName, new Integer(chn));
                }
            }
        }

        for (Map.Entry<String, Integer> entry : portMap.entrySet()) {
            String displayName = entry.getKey(); 
            String deviceId = prepend + displayName;

            if (entry.getValue().intValue() == 1) {
                displayName = displayName + "(1 channel)";
            } else {
                displayName = displayName + " (" + entry.getValue().intValue() + " channels)";
            }

            vals.add(new DeviceInfo(displayName, deviceId));
        }
    }

    protected static String findExecutableInPath(String exe, String[] paths) {
        for (String p : paths) {
            System.out.println(new File(p + File.separator + exe));
            if (new File(p + File.separator + exe).exists()) {
                return p + File.separator + exe;
            }
        }
        return null;
    }
}
