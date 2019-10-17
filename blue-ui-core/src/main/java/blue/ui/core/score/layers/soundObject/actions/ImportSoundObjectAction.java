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

import blue.SoundLayer;
import blue.score.TimeState;
import blue.score.layers.Layer;
import blue.score.layers.ScoreObjectLayer;
import blue.soundObject.SoundObject;
import blue.ui.core.score.ScorePath;
import blue.ui.core.score.layers.LayerGroupPanel;
import blue.ui.core.score.layers.soundObject.ScoreTimeCanvas;
import blue.ui.core.score.undo.AddScoreObjectEdit;
import blue.ui.utilities.FileChooserManager;
import blue.undo.BlueUndoManager;
import blue.utility.ObjectUtilities;
import electric.xml.Document;
import electric.xml.Element;
import java.awt.Point;
import java.awt.event.ActionEvent;
import java.io.File;
import java.util.List;
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
import org.openide.util.Utilities;
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
    private final TimeState timeState;
    private final ScorePath scorePath;

    public ImportSoundObjectAction() {
        this(Utilities.actionsGlobalContext());
    }

    public ImportSoundObjectAction(Lookup lookup) {
        super(NbBundle.getMessage(ImportSoundObjectAction.class,
                "CTL_ImportSoundObjectAction"));
        this.lGroupPanel = lookup.lookup(LayerGroupPanel.class);
        this.p = lookup.lookup(Point.class);
        this.timeState = lookup.lookup(TimeState.class);
        this.scorePath = lookup.lookup(ScorePath.class);
    }

    @Override
    public void actionPerformed(ActionEvent e) {

        ScoreTimeCanvas sCanvas = (ScoreTimeCanvas) lGroupPanel;

        List<File> retVal = FileChooserManager.getDefault().showOpenDialog(
                IMPORT_DIALOG, WindowManager.getDefault().getMainWindow());

        if (!retVal.isEmpty()) {

            File f = retVal.get(0);
            Document doc;

            try {
                doc = new Document(f);
                Element root = doc.getRoot();
                if (root.getName().equals("soundObject")) {
                    SoundObject tempSobj = (SoundObject) ObjectUtilities.loadFromXML(
                            root, null);

                    int start = p.x;
                    Layer layer = scorePath.getGlobalLayerForY(p.y);

                    if (timeState.isSnapEnabled()) {
                        int snapPixels = (int) (timeState.getSnapValue() * timeState.getPixelSecond());

                        start = start - (start % snapPixels);
                    }

                    float startTime = (float) start / timeState.getPixelSecond();
                    tempSobj.setStartTime(startTime);

                    ((SoundLayer) layer).add(tempSobj);

                    AddScoreObjectEdit edit = new AddScoreObjectEdit(
                            (ScoreObjectLayer)layer, tempSobj);

                    BlueUndoManager.setUndoManager("score");
                    BlueUndoManager.addEdit(edit);

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
        return new ImportSoundObjectAction(actionContext);
    }
}
