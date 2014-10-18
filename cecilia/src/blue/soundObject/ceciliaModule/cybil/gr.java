/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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

package blue.soundObject.ceciliaModule.cybil;

import java.util.ArrayList;

import blue.soundObject.ceciliaModule.CGraph;
import blue.soundObject.ceciliaModule.CGraphPoint;

class gr extends CybilAlgorithm {
    CGraph cgraph = null;

    public void setCGraph(CGraph cgraph) {
        this.cgraph = cgraph;
        System.out.println(cgraph);
    }

    public float[] getValue(CybilNoteList cybilNoteList) {

        /*
         * TODO - Build in terms of li algorithm
         */

        // float start = getFloatValue(args.get(0));
        // float end = getFloatValue(args.get(1));

        float timeValue = getTimeValue(args.get(args.size() - 1));

        ArrayList points = cgraph.getPoints();

        for (int i = 1; i < points.size(); i++) {
            CGraphPoint startPoint = (CGraphPoint) points.get(i - 1);
            CGraphPoint endPoint = (CGraphPoint) points.get(i);

            li line = new li();

            float duration = (endPoint.time - startPoint.time) * timeValue;

            line.args.add(Float.toString(startPoint.value));
            line.args.add(Float.toString(endPoint.value));
            line.args.add(Float.toString(duration) + "s");

            System.out.println("gr:\n " + startPoint + "\n" + endPoint);

            line.getValue(cybilNoteList);

        }

        // NoteList notes = cybilNoteList.notes;
        //        
        //        
        //        
        // if(cybilNoteList.pfield == 2) {
        // if(isTime) {
        //                
        // } else {
        //                
        // }
        // } else {
        // if(isTime) {
        //                
        // } else {
        //                
        // }
        // }

        return null;
    }
}