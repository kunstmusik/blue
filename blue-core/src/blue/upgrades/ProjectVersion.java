/*
 * blue - object composition environment for csound
 * Copyright (c) 2012 Steven Yi (stevenyi@gmail.com)
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
package blue.upgrades;

/**
 * Handles parsing of version strings and comparison of versions to each other.
 * Used by UpgradeManager to determine if an upgrade is necessary.
 * 
 * @author stevenyi
 */
public class ProjectVersion {

    int[] versionParts = null;
    boolean beta = false;

    private ProjectVersion() {
    }

    public static ProjectVersion parseVersion(String versionString) {
        ProjectVersion version = new ProjectVersion();

        if (versionString != null && !versionString.isEmpty()) {
            String[] parts = versionString.split("_");

            if (parts.length >= 2) {
                version.beta = true;
            }

            parts = parts[0].split("\\.");
            
            version.versionParts = new int[parts.length];
            
            for (int i = 0; i < parts.length; i ++) {
                int part;
                try {
                    part = Integer.parseInt(parts[i]);
                    
                } catch (NumberFormatException nfe) {
                    part = -1;
                }
                version.versionParts[i] = part;
            }
        }

        return version;
    }

    public boolean lessThan(ProjectVersion version) {
        for(int i = 0; i < 3; i++) {
            if(versionParts[i] != version.versionParts[i]) {
                return (versionParts[i] < version.versionParts[i]); 
            }
        }
        
        if(beta && !version.beta) {
            return true;
        }
        
        return false;
    }
    
    @Override
    public String toString() {
        StringBuilder builder = new StringBuilder();
        builder.append("Version:");
        
        if(versionParts == null) {
            builder.append(" Empty");
        } else {
            for (int part : versionParts) {
                builder.append(" ").append(part);
            }
            if (beta) {
                builder.append(" BETA");
            }    
        }
        
        
        return builder.toString();
    }
}
