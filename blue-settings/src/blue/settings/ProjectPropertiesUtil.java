/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */

package blue.settings;

import blue.ProjectProperties;

/**
 *
 * @author syi
 */
public class ProjectPropertiesUtil {
    public static String getRealtimeCommandLine(ProjectProperties props) {

        if (props.completeOverride) {

            String retVal = props.advancedSettings;

            if (!GeneralSettings.getInstance().isMessageColorsEnabled()) {
                retVal += " -+msg_color=false ";
            }

            return retVal;
        }

        StringBuffer buffer = new StringBuffer();

        RealtimeRenderSettings settings = RealtimeRenderSettings.getInstance();

        buffer.append(
                settings.getCommandLine(props.useAudioOut, props.useAudioIn, props.useMidiIn,
                        props.useMidiOut)).append(" ");
        buffer.append(getMessageLevelFlag(props)).append(" ");
        buffer.append(props.advancedSettings);

        return buffer.toString();
    }

    protected static String getMessageLevelFlag(ProjectProperties props) {
        int val = 0;

        if (props.noteAmpsEnabled) {
            val += 1;
        }

        if (props.outOfRangeEnabled) {
            val += 2;
        }

        if (props.warningsEnabled) {
            val += 4;
        }

        if (props.benchmarkEnabled) {
            val += 128;
        }

        return "-m" + val;

    }
}
