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
package blue.ui.core.score.mouse;

import blue.score.ScoreObject;
import java.awt.event.MouseEvent;
import java.util.Collection;
import java.util.Collections;
import org.openide.util.Utilities;

/**
 *
 * @author stevenyi
 */
public class ScoreObjectSelectionListener extends BlueMouseAdapter {

    @Override
    public void mousePressed(MouseEvent e) {
        if (currentScoreObjectView == null) {
            return;
        }

        e.consume();
        ScoreObject scoreObj = currentScoreObjectView.getScoreObject();
        Collection<? extends ScoreObject> selectedScoreObjects =
                Utilities.actionsGlobalContext().lookupAll(ScoreObject.class);

        if (e.isShiftDown()) {
            if (selectedScoreObjects.contains(scoreObj)) {
                content.remove(scoreObj);
            } else {
                content.add(scoreObj);
            }
        } else {
            if (!selectedScoreObjects.contains(scoreObj)) {
                content.set(Collections.singleton(scoreObj), null);
            }
        }

    }
}
