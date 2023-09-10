/*
 * blue - object composition environment for csound
 * Copyright (c) 2023 Steven Yi (stevenyi@gmail.com)
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
package blue.time;

/**
 * Context of time for a project. Used to resolve TimeUnit values according to meter, tempo, and sample rate.
 *
 * @author stevenyi
 */
public class TimeContext {
    
    private long sampleRate;
    private MeterMap meterMap;
    private TempoMap tempoMap;
    
    public TimeContext() {
        sampleRate = 44100;
        meterMap = new MeterMap();
        tempoMap = new TempoMap();
    }
    
    public TimeContext(long sampleRate, MeterMap meterMap, TempoMap tempoMap) {
        this.sampleRate = sampleRate;
        this.meterMap = meterMap;
        this.tempoMap = tempoMap;
    }
    
    public TimeContext(TimeContext tc) {
        this.sampleRate = tc.sampleRate;
        this.meterMap = new MeterMap(tc.meterMap);
        this.tempoMap = new TempoMap(tc.tempoMap);
    }
}
