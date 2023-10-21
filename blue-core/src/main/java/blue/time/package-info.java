/*
 * blue - object composition environment for csound
 * Copyright (c) 2023 Steven Yi (stevenyi@gmail.com)
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

/**
 * 
 * The blue.time package includes code for working with musical time.
 * 
 * TimeContext is the context in which all other time calculations are based 
 * upon. It includes sampleRate, a MeterMap (defines meters at given measure numbers), 
 * and a TempoMap (defines tempos at given TimeUnits). 
 * 
 * Beats and Measure.Beats time units can be converted from one to another using 
 * the MeterMap. These time units are then converted to clock time using tempoMap
 * and sample time using sampleRate. 
 * 
 * 
 * @author Steven Yi
 * 
 */


package blue.time;
