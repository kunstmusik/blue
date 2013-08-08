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
package blue.csnd6.render;

import blue.services.render.RealtimeRenderService;
import blue.services.render.RealtimeRenderServiceFactory;

/**
 *
 * @author stevenyi
 */

public class CS6RealtimeRenderServiceFactory implements RealtimeRenderServiceFactory {

    @Override
    public Class getRenderServiceClass() {
        return CS6RealtimeRenderService.class;
    }

    @Override
    public RealtimeRenderService createInstance() {
        return new CS6RealtimeRenderService();
    }

    @Override 
    public String toString() {
        return "Csound 6 API";
    }

    @Override
    public boolean isAvailable() {
        return APIUtilities.isCsoundAPIAvailable();
    }
}
