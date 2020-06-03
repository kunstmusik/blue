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

package blue;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 - 2004 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public final class BlueConstants {
    private static String version = "VERSION";

    private static String versionDate = "VERSION_DATE";

    static {
        InputStream constants = BlueConstants.class
                .getResourceAsStream("blueConstants.properties");
        Properties props = new Properties();
        try {
            props.load(constants);
            version = props.getProperty("blueVersion");
            versionDate = props.getProperty("blueReleaseDate");
        } catch (IOException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }

    }

    /**
     * @param version
     *            The version to set.
     */
    public static void setVersion(String version) {
        BlueConstants.version = version;
    }

    /**
     * @return Returns the version.
     */
    public static String getVersion() {
        return version;
    }

    /**
     * @param versionDate
     *            The versionDate to set.
     */
    public static void setVersionDate(String versionDate) {
        BlueConstants.versionDate = versionDate;
    }

    /**
     * @return Returns the versionDate.
     */
    public static String getVersionDate() {
        return versionDate;
    }

}
