/*
 * blue - object composition environment for csound
 * Copyright (C) 2018 stevenyi
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
package blue.components;

import blue.ui.core.score.SingleLineScoreSelection;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.util.WeakHashMap;

/**
 * This is somewhat of a hack to guarantee only one marquee for SingleLine is
 * showing at a time.
 * @author stevenyi
 */
public class SoloMarquee extends AlphaMarquee {

    private static WeakHashMap<SoloMarquee, Object> ALL_MARQUEES
            = new WeakHashMap<>();

    public SoloMarquee() {
        super();
        ALL_MARQUEES.put(this, null);
        this.addComponentListener(new ComponentAdapter() {
            @Override
            public void componentShown(ComponentEvent e) {
                hideOtherSoloMarquees();
            }

            @Override
            public void componentHidden(ComponentEvent e) {
                SingleLineScoreSelection.getInstance().clear();
            }

            
        });
    }

    private void hideOtherSoloMarquees() {
        for (SoloMarquee m : ALL_MARQUEES.keySet()) {
            if (m != this && m.isVisible()) {
                m.setVisible(false);
            }
        }
    }

}
