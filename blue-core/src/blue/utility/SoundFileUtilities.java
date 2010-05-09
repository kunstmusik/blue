/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2003 Steven Yi (stevenyi@gmail.com)
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

package blue.utility;

import java.io.File;
import java.io.IOException;

import javax.sound.sampled.AudioFileFormat;
import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.UnsupportedAudioFileException;

import blue.BlueSystem;

public class SoundFileUtilities {

    public static int getNumberOfChannels(String soundFileName)
            throws IOException, UnsupportedAudioFileException {
        File soundFile = BlueSystem.findFile(soundFileName);

        AudioFileFormat aFormat = AudioSystem.getAudioFileFormat(soundFile);
        AudioFormat format = aFormat.getFormat();

        return format.getChannels();
    }

    public static float getDurationInSeconds(String soundFileName)
            throws IOException, UnsupportedAudioFileException {
        File soundFile = BlueSystem.findFile(soundFileName);

        AudioFileFormat aFormat = AudioSystem.getAudioFileFormat(soundFile);
        AudioFormat format = aFormat.getFormat();

        float duration = aFormat.getByteLength()
                / (format.getSampleRate() * (format.getSampleSizeInBits() / 8) * format
                        .getChannels());

        return duration;
    }

    /**
     * @param fileName
     * @return
     */
    public static int getNumberOfFrames(String soundFileName)
            throws IOException, UnsupportedAudioFileException {

        File soundFile = BlueSystem.findFile(soundFileName);

        AudioFileFormat aFormat = AudioSystem.getAudioFileFormat(soundFile);

        return aFormat.getFrameLength();

    }

    /**
     * @param fileName
     * @return
     */
    public static float getSampleRate(String soundFileName) throws IOException,
            UnsupportedAudioFileException {

        File soundFile = BlueSystem.findFile(soundFileName);

        AudioFileFormat aFormat = AudioSystem.getAudioFileFormat(soundFile);
        AudioFormat format = aFormat.getFormat();

        return format.getSampleRate();
    }
}
