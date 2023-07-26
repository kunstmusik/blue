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

import blue.BlueSystem;
import blue.SoundLayer;
import blue.score.TimeState;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScorePath;
import blue.ui.core.score.ScoreTopComponent;
import blue.ui.core.score.layers.soundObject.ScoreTimeCanvas;
import blue.ui.core.score.undo.AddScoreObjectEdit;
import blue.ui.nbutilities.lazyplugin.LazyPlugin;
import blue.ui.nbutilities.lazyplugin.LazyPluginFactory;
import blue.undo.BlueUndoManager;
import blue.utility.ScoreUtilities;
import java.awt.Point;
import java.awt.event.ActionEvent;
import java.lang.ref.WeakReference;
import java.lang.reflect.InvocationTargetException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JMenu;
import javax.swing.JMenuItem;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.ContextAwareAction;
import org.openide.util.Exceptions;
import org.openide.util.Lookup;
import org.openide.util.NbBundle.Messages;
import org.openide.util.actions.Presenter;
import org.openide.windows.WindowManager;

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.layers.soundObject.actions.AddSoundObjectActionsPresenter")
@ActionRegistration(
        displayName = "#CTL_AddSoundObjectActionsPresenter")
@Messages("CTL_AddSoundObjectActionsPresenter=Add &SoundObject")
@ActionReference(path = "blue/score/layers/soundObject/actions",
        position = 40, separatorAfter = 45)
public final class AddSoundObjectActionsPresenter extends AbstractAction implements
        ContextAwareAction, Presenter.Popup {

    Map<String, Class> sObjNameClassMap = new HashMap<>();
    JMenu menu = null;
    WeakReference<Point> pRef = null;
    WeakReference<ScoreTimeCanvas> sTimeCanvasRef = null;

    @Override
    public void actionPerformed(ActionEvent e) {

        if (pRef == null || sTimeCanvasRef == null) {
            return;
        }

        var scorePath = ScoreController.getInstance().getScorePath();

        Point p = pRef.get();

        ScoreTopComponent stc = (ScoreTopComponent) WindowManager.getDefault().
                findTopComponent("ScoreTopComponent");

        LazyPlugin<SoundObject> plugin = (LazyPlugin<SoundObject>) ((JMenuItem) e.getSource()).getClientProperty(
                "plugin");

        try {

            var l = scorePath.getGlobalLayerForY(p.y);

            if (l instanceof SoundLayer) {
                var sLayer = (SoundLayer) l;
                SoundObject sObj = plugin.getInstance().
                        getClass().getDeclaredConstructor().newInstance();

                if (sObj instanceof PolyObject) {
                    ((PolyObject) sObj).newLayerAt(0);
                }

                TimeState timeState = stc.getTimeState();

                double start = p.getX() / timeState.getPixelSecond();

                if (timeState.isSnapEnabled()) {
                    start = ScoreUtilities.getSnapValueStart(start,
                            timeState.getSnapValue());
                }
                sObj.setStartTime(start);

                sLayer.add(sObj);
                BlueUndoManager.setUndoManager("score");
                BlueUndoManager.addEdit(new AddScoreObjectEdit(
                        sLayer, sObj));
            }

        } catch (InstantiationException | NoSuchMethodException
                | SecurityException | IllegalAccessException
                | InvocationTargetException ex) {
            Exceptions.printStackTrace(ex);
        }
    }

    @Override
    public JMenuItem getPopupPresenter() {
        if (menu == null) {
            menu = new JMenu("Add SoundObject");

            List<LazyPlugin<SoundObject>> plugins = LazyPluginFactory.loadPlugins(
                    "blue/score/soundObjects", SoundObject.class);

            for (LazyPlugin<SoundObject> plugin : plugins) {

                JMenuItem temp = new JMenuItem();
                temp.setText(
                        BlueSystem.getString("soundLayerPopup.addNew") + " "
                        + plugin.getDisplayName());
                temp.putClientProperty("plugin", plugin);
                temp.setActionCommand(plugin.getDisplayName());
                temp.addActionListener(this);
                menu.add(temp);
            }
        }

        return menu;
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext
    ) {
        pRef = new WeakReference<>(actionContext.lookup(Point.class));
        sTimeCanvasRef = new WeakReference<>(actionContext.lookup(
                ScoreTimeCanvas.class));
        return this;
    }
}
