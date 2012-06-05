/*
 * blue - object composition environment for csound
 * Copyright (c) 2010 Steven Yi (stevenyi@gmail.com)
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
package blue.ui.core.project.stems;

import blue.BlueData;
import blue.InstrumentAssignment;
import blue.settings.GeneralSettings;
import blue.ui.core.project.RenderToDiskUtility;
import blue.ui.core.render.APIRunner;
import blue.ui.core.render.CSDRunner;
import blue.ui.core.render.CommandlineRunner;
import blue.utility.APIUtilities;
import blue.utility.ObjectUtilities;
import java.util.ArrayList;
import java.util.Iterator;
import org.openide.util.Exceptions;

/**
 *
 * @author syi
 */
public class ExportStemsRenderer {



    public void exportStemsByLayer(BlueData data) {
    }

    public void exportStemsByInstrument(BlueData data) {
        
        BlueData tempData = (BlueData)ObjectUtilities.clone(data);
        
        ArrayList<InstrumentAssignment> instrumentAssignments = tempData.getArrangement().getArrangement();

        for (Iterator<InstrumentAssignment> it = instrumentAssignments.iterator(); it.hasNext();) {
            InstrumentAssignment instrumentAssignment = it.next();

            if (!instrumentAssignment.enabled) {

                it.remove();

            }
        }


        for (int i = 0; i < instrumentAssignments.size(); i++) {

            InstrumentAssignment ia = instrumentAssignments.get(i);

            for (int j = 0; j < instrumentAssignments.size(); j++) {

                InstrumentAssignment temp = instrumentAssignments.get(j);

                temp.enabled = (temp == ia);

            }

            RenderToDiskUtility.getInstance().renderToDisk(data, false);

        }


    }

    public void exportStemsByLayerGroup(BlueData data) {
    }
}
