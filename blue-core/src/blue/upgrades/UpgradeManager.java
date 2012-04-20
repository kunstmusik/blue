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
import electric.xml.Attribute;
import electric.xml.Element;
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
        upgraders.add(new ProjectUpgrader_2_1_10());
        upgraders.add(new ProjectUpgrader_2_3_0());
    }

    public void performPreUpgrades(Element element) {
        
        Attribute versionAttribute = element.getAttribute("version");
        String versionString = "0.0.0";
        if (versionAttribute != null) {
            versionString = versionAttribute.getValue();
        }
        
        ProjectVersion version = ProjectVersion.parseVersion(versionString);
        
        for (ProjectUpgrader upgrader : upgraders) {
            if(version.lessThan(upgrader.getVersion())) {
                if(upgrader.preUpgrade(element)) {
                    logger.info(String.format("Performed Pre-Upgrade for Version '%s'", upgrader.getVersion()));
                }
            }
        }
    }
    
    public void performUpgrades(BlueData data) {
        
        ProjectVersion version = ProjectVersion.parseVersion(data.getVersion());
        
        for (ProjectUpgrader upgrader : upgraders) {
            if(version.lessThan(upgrader.getVersion())) {
                
                if(upgrader.upgrade(data)) {
                    logger.info(String.format("Performed Upgrade for Version '%s'", upgrader.getVersion()));
                }
            }
        }
    }

}
