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

import blue.BlueData;
import blue.score.ScoreGenerationException;
import org.openide.util.Lookup;

/**
 * Injectable Singleton Service for transforming a BlueData class into a
 * CsdRenderResult
 * @author stevenyi
 */
public abstract class CSDRenderService {
    public static CSDRenderService getDefault() {
        return Lookup.getDefault().lookup(CSDRenderService.class);
    }
    
    public synchronized CsdRenderResult generateCSDForBlueLive(BlueData data, boolean useAPI) {
        return generateCSDForBlueLiveImpl(data, useAPI);
    }
    
    protected abstract CsdRenderResult generateCSDForBlueLiveImpl(BlueData data, boolean useAPI);
    
    public final synchronized CsdRenderResult generateCSD(BlueData data,
            double startTime, double endTime, boolean isRealTime, boolean useAPI) throws ScoreGenerationException {
        return generateCSDImpl(data, startTime, endTime, isRealTime, useAPI);
    }

    protected abstract CsdRenderResult generateCSDImpl(BlueData data,
            double startTime, double endTime, boolean isRealTime, boolean useAPI); 
            
    }
