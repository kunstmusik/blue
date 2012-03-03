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

import blue.BlueData;
import blue.ProjectProperties;
import blue.utility.TextUtilities;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.logging.Logger;

/**
 * Handles upgrading projects. Currently has a statically defined registry of
 * upgrades. May later be made dynamic and allow other modules to add their own
 * upgraders.
 *
 * @author stevenyi
 */
public class UpgradeManager {

    Logger logger = Logger.getLogger("UpgradeManager");
    
    private ArrayList<ProjectUpgrader> upgraders = new ArrayList<ProjectUpgrader>();
    private static UpgradeManager instance = null;

    public static UpgradeManager getInstance() {
        if (instance == null) {
            instance = new UpgradeManager();
        }
        return instance;
    }

    private UpgradeManager() {
        upgraders.add(new ProjectUpgrader("2.1.10") {

            /**
             * Added in 2.1.10 when 0dbfs added as a full property in UI
             */
            @Override
            public boolean upgrade(BlueData data) {

                String globalOrc = data.getGlobalOrcSco().getGlobalOrc();

                if (!globalOrc.contains("0dbfs")) {
                    return true;
                }

                StringBuilder buffer = new StringBuilder();

                BufferedReader reader = new BufferedReader(new StringReader(globalOrc));
                String str;
                ProjectProperties projectProperties = data.getProjectProperties();
                
                try {
                    while ((str = reader.readLine()) != null) {

                        if (str.trim().startsWith("0dbfs") && str.contains("=")) {
                            str = TextUtilities.stripSingleLineComments(str);
                            str = str.substring(str.indexOf("=") + 1).trim();
                            projectProperties.useZeroDbFS = true;
                            projectProperties.zeroDbFS = str;
                            projectProperties.diskUseZeroDbFS = true;
                            projectProperties.diskZeroDbFS = str;
                        } else {
                            buffer.append(str).append("\n");
                        }
                    }

                } catch (IOException e) {
                    e.printStackTrace();
                }

                data.getGlobalOrcSco().setGlobalOrc(buffer.toString());
                return true;
            }
            
        });

    }

    public void performUpgrades(BlueData data) {
        
        ProjectVersion version = ProjectVersion.parseVersion(data.getVersion());
        
        for (ProjectUpgrader upgrader : upgraders) {
            if(version.lessThan(upgrader.getVersion())) {
                logger.info(String.format("Performing Upgrader for Version '%s'", upgrader.getVersion()));
                upgrader.upgrade(data);
            }
        }
    }

}
