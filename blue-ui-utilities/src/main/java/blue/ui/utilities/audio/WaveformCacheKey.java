/*
 * blue - object composition environment for csound
 * Copyright (C) 2015
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
package blue.ui.utilities.audio;

/**
 *
 * @author stevenyi
 */
public class WaveformCacheKey {

    private final String fileName;
    private long checksum;
    private final int pixelSeconds;

    public WaveformCacheKey(String fileName, long checksum, int pixelSeconds) {
        this.fileName = (fileName == null) ? "" : fileName;
        this.checksum = checksum;
        this.pixelSeconds = pixelSeconds;
    }

    @Override
    public boolean equals(Object obj) {
        if(obj instanceof WaveformCacheKey) {
            WaveformCacheKey that = (WaveformCacheKey)obj;
            return  this.fileName.equals(that.fileName) && 
                    this.checksum == that.checksum &&
                    this.pixelSeconds == that.pixelSeconds;
        }     
        return false;
    }

    @Override
    public int hashCode() {
        return fileName.hashCode() + pixelSeconds + Long.hashCode(checksum); 
    }

    
}
