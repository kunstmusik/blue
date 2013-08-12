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
package blue.services.render;

/**
 * Provider Service class that will provide instances of DiskRenderServices. 
 * 
 * Implementers should override toString as that will be displayed in the 
 * settings dropdown to the user.
 * 
 * @author stevenyi
 */
public interface DiskRenderServiceFactory {

    /** Returns the Class for the generated RenderServices */
    public Class getRenderServiceClass();

    /** Creates an instance of a RealtimeRenderService */
    public DiskRenderService createInstance();

    /** 
     * reports if this service is available.  For example, if the the user does
     * not have the Csound 6 API available, then the CS6 factory would report
     * false.
     * @return 
     */
    public boolean isAvailable();
}
