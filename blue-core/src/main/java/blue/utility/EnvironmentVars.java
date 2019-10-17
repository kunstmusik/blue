/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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

/**
 * Code used from: http://www.rgagnon.com/javadetails/java-0150.html
 */

package blue.utility;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.Properties;

public class EnvironmentVars {

    private static Properties envVars;

    static {
        initializeProperties();
    }

    public static void initializeProperties() {
        Process p = null;
        envVars = new Properties();
        Runtime r = Runtime.getRuntime();
        String OS = System.getProperty("os.name").toLowerCase();

        try {
            if (OS.contains("windows 9")) {
                p = r.exec("command.com /c set");
            } else if ((OS.contains("nt"))
                    || (OS.contains("windows 20"))
                    || (OS.contains("windows xp"))) {

                p = r.exec("cmd.exe /c set");
            } else {
                // our last hope, we assume Unix (thanks to H. Ware for the fix)
                p = r.exec("env");
            }
            try (BufferedReader br = new BufferedReader(new InputStreamReader(p
                         .getInputStream()))) {
                String line;

                while ((line = br.readLine()) != null) {
                    int idx = line.indexOf('=');
                    String key = line.substring(0, idx);
                    String value = line.substring(idx + 1);
                    envVars.setProperty(key, value);
                }
            }
        } catch (IOException ioe) {
            System.err
                    .println("Error - EnvironmentVars: Could not read environment variables");
        }

    }

    public static String getProperty(String propertyName) {
        return (String) envVars.get(propertyName);
    }

    /**
     * @param args
     */
    public static void main(String[] args) {
        // TODO Auto-generated method stub

    }

}
