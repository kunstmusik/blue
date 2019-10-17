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
package blue.midi;

/**
 *
 * @author syi
 */
public enum MidiKeyMapping {

    MIDI, PCH, OCT, CONSTANT, TUNING_BLUE_PCH, TUNING_CPS;

    @Override
    public String toString() {
        switch (this) {
            case MIDI:
                return "MIDI";
            case PCH:
                return "Csound PCH";
            case OCT:
                return "Csound OCT";
            case CONSTANT:
                return "Constant";
            case TUNING_BLUE_PCH:
                return "Tuning - bluePCH";
            case TUNING_CPS:
                return "Tuning - CPS";
        }
        return null;
    }
}
