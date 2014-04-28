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
package blue.ui.core.score.object.actions;

import blue.score.ScoreObject;
import blue.soundObject.Instance;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.ui.utilities.FileChooserManager;
import electric.xml.Element;
import java.awt.event.ActionEvent;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.Collection;
import java.util.Iterator;
import java.util.List;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JFileChooser;
import javax.swing.JOptionPane;
import javax.swing.SwingUtilities;
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
        id = "blue.ui.core.score.actions.ExportAction")
@ActionRegistration(
        displayName = "#CTL_ExportAction")
@Messages("CTL_ExportAction=E&xport")
@ActionReference(path = "blue/score/actions", position = 500)
public final class ExportAction extends AbstractAction
        implements ContextAwareAction {

    private static final String EXPORT_DIALOG = "sObj.export";

    private final Collection<? extends ScoreObject> scoreObjects;
    private final Collection<? extends SoundObject> soundObjects;

    public ExportAction() {
        this(Utilities.actionsGlobalContext());
    }

    public ExportAction(Lookup lookup) {

        super(NbBundle.getMessage(ExportAction.class, "CTL_ExportAction"));
        scoreObjects = lookup.lookupAll(ScoreObject.class);
        soundObjects = lookup.lookupAll(SoundObject.class);
    }

    @Override
    public void actionPerformed(ActionEvent e) {

        if (scoreObjects.size() == 1 && soundObjects.size() == 1) {

            int retVal = FileChooserManager.getDefault().showSaveDialog(
                    EXPORT_DIALOG, WindowManager.getDefault().getMainWindow());

            if (retVal == JFileChooser.APPROVE_OPTION) {

                File f = FileChooserManager.getDefault().getSelectedFile(
                        EXPORT_DIALOG);

                if (f.exists()) {
                    int overWrite = JOptionPane.showConfirmDialog(
                            SwingUtilities.getRoot(
                                    WindowManager.getDefault().getMainWindow()),
                            "Please confirm you would like to overwrite this file.");

                    if (overWrite != JOptionPane.OK_OPTION) {
                        return;
                    }
                }

                SoundObject sObj = soundObjects.iterator().next();
                if ((sObj instanceof Instance)
                        || ((sObj instanceof PolyObject) && containsInstance(
                                (PolyObject) sObj))) {
                    JOptionPane.showMessageDialog(
                            WindowManager.getDefault().getMainWindow(),
                            "Error: Export of Instance or " + "PolyObjects containing Instance " + "is not allowed.",
                            "Error", JOptionPane.ERROR_MESSAGE);
                    return;
                }

                Element node = sObj.saveAsXML(null);

                PrintWriter out;

                try {
                    out = new PrintWriter(new FileWriter(f));
                    out.print(node.toString());

                    out.flush();
                    out.close();
                } catch (IOException ex) {
                    ex.printStackTrace();
                }
            }
        }
    }

    protected boolean containsInstance(PolyObject pObj) {
        List<SoundObject> soundObjects = pObj.getSoundObjects(true);

        for (Iterator<SoundObject> iter = soundObjects.iterator(); iter.hasNext();) {
            SoundObject sObj = iter.next();

            if (sObj instanceof PolyObject) {
                if (containsInstance((PolyObject) sObj)) {
                    return true;
                }
            } else if (sObj instanceof Instance) {
                return true;
            }
        }
        return false;
    }
    
    @Override
    public boolean isEnabled() {
        return scoreObjects.size() == 1 && soundObjects.size() == 1;
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new ExportAction(actionContext);
    }
}
