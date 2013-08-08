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
package csnd6;

import blue.csnd6.render.APIUtilities;
import blue.csnd6.render.CS6DiskRenderServiceFactory;
import blue.csnd6.render.CS6RealtimeRenderServiceFactory;
import central.lookup.CentralLookup;
import org.openide.modules.ModuleInstall;

public class Installer extends ModuleInstall {

    @Override
    public void restored() {
        if(APIUtilities.isCsoundAPIAvailable()) {
            CentralLookup.getDefault().add(new CS6DiskRenderServiceFactory());
            CentralLookup.getDefault().add(new CS6RealtimeRenderServiceFactory());
        }
    }
}
