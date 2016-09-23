/*
 * blue - object composition environment for csound
 * Copyright (c) 2001-2003 Steven Yi (stevenyi@gmail.com)
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
package blue.utility;

import blue.BlueData;
import blue.Orchestra;
import blue.orchestra.GenericInstrument;
import java.io.*;
import java.util.StringTokenizer;

/**
 * Description of the Class
 *
 * @author steven
 * @created November 11, 2001
 */
public class blueSHARC {

    /**
     * Constructor for the blueSHARC object
     */
    public blueSHARC() {
    }

    /**
     * Gets the instName attribute of the blueSHARC object
     *
     * @param fileName Description of the Parameter
     * @return The instName value
     */
    public String getInstName(String fileName) {
        int index = fileName.indexOf(".spect");
        return fileName.substring(0, index);
    }

    /**
     * Gets the pitch attribute of the blueSHARC object
     *
     * @param fileName Description of the Parameter
     * @return The pitch value
     */
    public String getPitch(String fileName) {
        int index1 = fileName.indexOf('_') + 1;
        int index2 = fileName.indexOf(".spect");

        String temp = fileName.substring(index1, index2);

        String pitch = temp.substring(0, temp.length() - 1);
        int octave = Integer.parseInt(temp.substring(temp.length() - 1));

        if (pitch.equalsIgnoreCase("c")) {
            pitch = "00";
        } else if (pitch.equalsIgnoreCase("c#")) {
            pitch = "01";
        } else if (pitch.equalsIgnoreCase("d")) {
            pitch = "02";
        } else if (pitch.equalsIgnoreCase("d#")) {
            pitch = "03";
        } else if (pitch.equalsIgnoreCase("e")) {
            pitch = "04";
        } else if (pitch.equalsIgnoreCase("f")) {
            pitch = "05";
        } else if (pitch.equalsIgnoreCase("f#")) {
            pitch = "06";
        } else if (pitch.equalsIgnoreCase("g")) {
            pitch = "07";
        } else if (pitch.equalsIgnoreCase("g#")) {
            pitch = "08";
        } else if (pitch.equalsIgnoreCase("a")) {
            pitch = "09";
        } else if (pitch.equalsIgnoreCase("a#")) {
            pitch = "10";
        } else if (pitch.equalsIgnoreCase("b")) {
            pitch = "11";
        }

        octave += 4;
        pitch = octave + "." + pitch;

        return pitch;
    }

    /**
     * Description of the Method
     *
     * @param fileName Description of the Parameter
     * @return Description of the Return Value
     */
    public String convertSHARC(File fileName) {
        StringBuffer buffer = new StringBuffer();

        try {
            FileInputStream fileIn = new FileInputStream(fileName);
            BufferedReader in = new BufferedReader(
                    new InputStreamReader(fileIn));
            String temp;
            int counter = 1;
            float ampNorm = 0;

            buffer.append("ifreq 	= 		cpspch(").append(this.getPitch(fileName.getName())).append(")\n");
            buffer.append("iamp	=		p4\n");
            buffer.append("iSpace	=	        p5		;range -1(L) to 1(R)\n\n");
            buffer.append("kenv	linseg 0, p3 * 0.5, 1, p3 * 0.5, 0\n");
            buffer
                    .append("krtl       =      sqrt(2) / 2 * cos(iSpace) + sin(iSpace)\n");
            buffer
                    .append("krtr       =      sqrt(2) / 2 * cos(iSpace) - sin(iSpace)\n\n");

            while ((temp = in.readLine()) != null && counter < 33) {
                StringTokenizer a = new StringTokenizer(temp);
                if (a.countTokens() == 2) {
                    float amp = Float.parseFloat((String) a.nextElement());
                    amp = Math.abs(amp);

                    /*
                     * String tempAmp = String.valueOf(amp); int index =
                     * tempAmp.indexOf('.'); tempAmp =
                     * tempAmp.substring(0,index);
                     */
                    double degrees = Math.toDegrees(Double
                            .parseDouble((String) a.nextElement()));

                    /*
                     * String temp2 = String.valueOf(degrees); index =
                     * temp2.indexOf('.'); temp2 = temp2.substring(0, index);
                     */
                    buffer.append("iamp").append(counter).append("	=		ampdb(p4 - ").append(amp).append(")\n");
                    buffer.append("a").append(counter).append("\toscili  	kenv * iamp").append(counter).append(", ifreq *").append(counter).append(" , 1, ").append(degrees).append("\n");
                    ampNorm += amp;
                }
                counter++;
            }

            StringBuilder aout = new StringBuilder("aout sum a1");

            for (int i = 1; i < (counter - 1); i++) {
                aout.append(", a").append(i + 1);
            }

            /*
             * while(counter2 < (counter - 1)) { if((counter2 % 10) == 0) {
             * aout.append("\naout = aout "); } aout.append("+ a" + (counter2
             * +1) + " "); counter2++; }
             */
            buffer.append("\n").append(aout.toString()).append("\n");
            // buffer.append("aout = kenv * (aout / " + ampNorm + ")\n\n");
            buffer.append("aLeft 	=	aout * krtl\n");
            buffer.append("aRight	=	aout * krtr\n\n");
            buffer.append("\touts 	aLeft, aRight");
        } catch (IOException | NumberFormatException e) {
            e.printStackTrace();
            buffer = new StringBuffer("error");
        }

        return buffer.toString();
    }

    /**
     * Description of the Method
     *
     * @param args Description of the Parameter
     */
    public static void main(String args[]) {

        // args[0] = "";
        blueSHARC bSHARC = new blueSHARC();
        BlueData data = new BlueData();
        Orchestra orch = data.getOrchestra();

        File home = new File("g:\\sharc");
        File dir[] = home.listFiles(new FileFilter() {
            // <-- gets subdirectories
            @Override
            public boolean accept(File in) {
                return in.isDirectory();
            }
        });
        for (int i = 0; i < dir.length; i++) {
            File spects[] = dir[i].listFiles(new FileFilter() {
                @Override
                public boolean accept(File in) {
                    return in.getName().endsWith(".spect");
                }
            });
            for (int j = 0; j < spects.length; j++) {
                String temp = bSHARC.convertSHARC(spects[j]);
                GenericInstrument tempInst = new GenericInstrument();
                tempInst.setName(bSHARC.getInstName(spects[j].getName()));
                tempInst.setText(temp);
                orch.addInstrument(tempInst);
            }
        }

        // FIXME - is this class file even worth keeping...?
//            XMLSerializer xmlSer = new XMLSerializer();
//            try (PrintWriter out = new PrintWriter(new FileWriter(
//                         "C:\\WINDOWS\\Desktop\\SHARC.blue"))) {
//                xmlSer.write(out, data);
//                out.flush();
//            }
    }
}
