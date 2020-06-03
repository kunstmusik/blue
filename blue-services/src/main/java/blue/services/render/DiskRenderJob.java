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
import java.io.File;

/**
 *
 * @author stevenyi
 */
public final class DiskRenderJob {

    private String[] args;
    private String filename;
    private BlueData data;
    File currentWorkingDirectory;

    public DiskRenderJob(String[] args, String filename, BlueData data,
                         File currentWorkingDirectory) {
        this.args = args;
        this.filename = filename;
        this.data = data;
        this.currentWorkingDirectory = currentWorkingDirectory;
    }

    /**
     * @return the args
     */
    public String[] getArgs() {
        return args;
    }

    /**
     * @return the filename
     */
    public String getFilename() {
        return filename;
    }

    /**
     * @return the data
     */
    public BlueData getData() {
        return data;
    }

    /**
     * @return the currentWorkingDirectory
     */
    public File getCurrentWorkingDirectory() {
        return currentWorkingDirectory;
    }
}
