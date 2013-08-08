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
package csnd5;

import blue.csnd5.render.APIUtilities;
import blue.csnd5.render.CS5DiskRenderServiceFactory;
import blue.csnd5.render.CS5RealtimeRenderServiceFactory;
import blue.services.render.DiskRenderServiceFactory;
import central.lookup.CentralLookup;
import org.openide.modules.ModuleInstall;

public class Installer extends ModuleInstall {

    @Override
    public void restored() {
        CentralLookup lookup = CentralLookup.getDefault();

        // if csound 6 hasn't loaded, then try loading Csound 5 API's
        if (lookup.lookupAll(DiskRenderServiceFactory.class).isEmpty()) {
            if (APIUtilities.isCsoundAPIAvailable()) {
                lookup.add(new CS5DiskRenderServiceFactory());
                lookup.add(new CS5RealtimeRenderServiceFactory());
            }
        }
    }
}
