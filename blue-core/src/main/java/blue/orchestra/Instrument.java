/*
 * blue - object composition environment for csound
 * Copyright (c) 2001-2003 Steven Yi (stevenyi@gmail.com)
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

package blue.orchestra;

import blue.DeepCopyable;
import blue.Tables;
import blue.udo.OpcodeList;
import electric.xml.Element;

/**
 * Plugin Interface for Instruments in Blue's Orchestra
 * 
 * Instruments are dynamically aloaded at runtime by BlueSystem. They are
 * registered in the registry.xml file.
 * 
 * When compiled out to CSD, the following methods are called in the following
 * order:
 * 
 * <nl>
 * <li>generateFTables</li>
 * <li>generateGlobalSco</li>
 * <li>generateGlobalOrc</li>
 * <li>generateInstruments</li>
 * </nl>
 * 
 */

public interface Instrument extends DeepCopyable<Instrument> {

    /**
     * Returns the name of the instrument.
     */
    String getName();

    /**
     * Sets the name of the instrument.
     */
    void setName(String name);

    /**
     * Returns the comments for the instrument.
     */
    String getComment();

    /**
     * Sets the comments for the instrument.
     */
    void setComment(String comment);

    /**
     * During CSD Generation, allows instrument add any UDO's required.
     * 
     * @param udos
     */
    void generateUserDefinedOpcodes(OpcodeList udos);

    /**
     * Returns a String value that contains Csound instrument text.
     * 
     * Should not include "instr #" or "endin", as this is added by the
     * orchestra at compile-time.
     */

    String generateInstrument();

    /**
     * Returns a String value that contains Csound instrument text that is
     * to be used for an always-on instrument code.
     *
     * Should not include "instr #" or "endin", as this is added by the
     * orchestra at compile-time.
     */
    String generateAlwaysOnInstrument();

    /**
     * During CSD generation, an instance of Tables is passed into all
     * Instruments so that Instruments can add Csound ftables if they need to.
     */
    void generateFTables(Tables tables);

    /**
     * During CSD generation, get any global orc code that this instrument
     * generates (useful for init code for variables, etc.)
     */
    String generateGlobalOrc();

    /**
     * During CSD generation, get any global sco code that this instrument
     * generates. Useful for any always-on instruments. Processing of
     * <TOTAL_DUR> and <PROCESSING_START> will occur after this is called.
     * 
     * Also, since instrument numbers are assigned in Arrangement, use of
     * instrument id's as "ix" will be replaced with the instrument of the
     * instrument as assigned in the Arrangement. For example, if an instrument
     * is in the Arrangement twice as instrument 3 and instrument "reverb", if
     * the instrument generates global sco of:
     * 
     * <code>
     * ix 0 [<TOTAL_DUR> + 5]
     * </code>
     * 
     * then two notes will be added to global sco as:
     * 
     * <code>
     * i3 [<TOTAL_DUR> + 5]
     * ireverb [<TOTAL_DUR> + 5]
     * </code>
     */
    String generateGlobalSco();

    // public static Instrument loadFromXML(Element data);

    Element saveAsXML();

}
