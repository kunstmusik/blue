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
package blue.ui.core.score.layers.soundObject.actions;

import blue.score.TimeState;
import blue.soundObject.SoundObject;
import blue.ui.core.score.layers.LayerGroupPanel;
import blue.ui.core.score.layers.soundObject.ScoreTimeCanvas;
import blue.ui.utilities.FileChooserManager;
import blue.utility.ObjectUtilities;
import electric.xml.Document;
import electric.xml.Element;
import java.awt.Point;
import java.awt.event.ActionEvent;
import java.io.File;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JFileChooser;
import javax.swing.JOptionPane;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.ContextAwareAction;
import org.openide.util.Lookup;
import org.openide.util.NbBundle;
import org.openide.util.NbBundle.Messages;
import org.openide.windows.WindowManager;

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.layers.soundObject.actions.ImportSoundObjectAction")
@ActionRegistration(
        displayName = "#CTL_ImportSoundObjectAction")
@Messages("CTL_ImportSoundObjectAction=Import")
@ActionReference(path = "blue/score/layers/soundObject/actions",
        position = 110)
public final class ImportSoundObjectAction extends AbstractAction
        implements ContextAwareAction {

    private static final String IMPORT_DIALOG = "sObj.import";
    protected LayerGroupPanel lGroupPanel;
    protected Point p;

    public ImportSoundObjectAction() {
        this(null, null);
    }

    public ImportSoundObjectAction(LayerGroupPanel lGroupPanel, Point p) {
        super(NbBundle.getMessage(ImportSoundObjectAction.class,
                "CTL_ImportSoundObjectAction"));
        this.lGroupPanel = lGroupPanel;
        this.p = p;
    }

    @Override
    public void actionPerformed(ActionEvent e) {

        ScoreTimeCanvas sCanvas = (ScoreTimeCanvas) lGroupPanel;

        int retVal = FileChooserManager.getDefault().showOpenDialog(
                IMPORT_DIALOG, WindowManager.getDefault().getMainWindow());

        if (retVal == JFileChooser.APPROVE_OPTION) {

            File f = FileChooserManager.getDefault().getSelectedFile(
                    IMPORT_DIALOG);
            Document doc;

            try {
                doc = new Document(f);
                Element root = doc.getRoot();
                if (root.getName().equals("soundObject")) {
                    SoundObject tempInstr = (SoundObject) ObjectUtilities.loadFromXML(
                            root, null);

                    int start = p.x;
                    TimeState timeState = sCanvas.getPolyObject().getTimeState();
                    int sLayerIndex = sCanvas.getPolyObject().getLayerNumForY(
                            p.y);

                    if (timeState.isSnapEnabled()) {
                        int snapPixels = (int) (timeState.getSnapValue() * timeState.getPixelSecond());

                        start = start - (start % snapPixels);
                    }

                    float startTime = (float) start / timeState.getPixelSecond();
                    tempInstr.setStartTime(startTime);

                    sCanvas.getPolyObject().addSoundObject(sLayerIndex,
                            tempInstr);

                } else {
                    JOptionPane.showMessageDialog(
                            WindowManager.getDefault().getMainWindow(),
                            "Error: File did not contain Sound Object",
                            "Error",
                            JOptionPane.ERROR_MESSAGE);
                }

            } catch (Exception ex) {
                ex.printStackTrace();
                JOptionPane.showMessageDialog(
                        WindowManager.getDefault().getMainWindow(),
                        "Error: Could not read Sound Object from file",
                        "Error", JOptionPane.ERROR_MESSAGE);
            }

        }

    }

    @Override
    public boolean isEnabled() {
        return lGroupPanel != null && p != null
                && (lGroupPanel instanceof ScoreTimeCanvas);
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new ImportSoundObjectAction(
                actionContext.lookup(LayerGroupPanel.class),
                actionContext.lookup(Point.class));
    }
}
