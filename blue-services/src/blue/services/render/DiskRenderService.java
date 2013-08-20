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

import blue.automation.Parameter;
import blue.noteProcessor.TempoMapper;
import java.io.File;
import java.util.ArrayList;

/**
 *
 * @author stevenyi
 */
public interface DiskRenderService {

    public void execWait(String[] args,
            File currentWorkingDirectory,
            float startTime,
            TempoMapper mapper,
            ArrayList<Parameter> parameters);

    public String execWaitAndCollect(String[] args, File currentWorkingDirectory);

    public void renderToDisk(DiskRenderJob job);
            
    public boolean isRunning();

    public void stop();

    public int getCsoundVersion(String csoundCommand);
    
}
