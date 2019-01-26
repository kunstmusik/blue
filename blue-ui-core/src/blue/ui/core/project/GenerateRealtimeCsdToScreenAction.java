/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.ui.core.project;

import blue.BlueData;
import blue.BlueSystem;
import blue.gui.ExceptionDialog;
import blue.gui.InfoDialog;
import blue.projects.BlueProjectManager;
import blue.services.render.CSDRenderService;
import blue.services.render.CsdRenderResult;
import blue.settings.RealtimeRenderSettings;
import blue.ui.core.render.CommandlineRealtimeRenderServiceFactory;
import blue.ui.core.render.CommandlineRunner;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
import org.openide.awt.ActionRegistration;
import org.openide.awt.StatusDisplayer;
import org.openide.util.NbBundle.Messages;
import org.openide.windows.WindowManager;

@ActionID(category = "Project",
id = "blue.ui.core.project.GenerateRealtimeCsdToScreenAction")
@ActionRegistration(displayName = "#CTL_GenerateRealtimeCsdToScreenAction")
@ActionReferences({
    @ActionReference(path = "Menu/Project", position = 10)
})
@Messages("CTL_GenerateRealtimeCsdToScreenAction=Generate Realtime CSD to Screen")
public final class GenerateRealtimeCsdToScreenAction implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {
        StatusDisplayer.getDefault().setStatusText(BlueSystem.getString(
                "message.generatingCSD"));

        BlueData data = BlueProjectManager.getInstance().getCurrentBlueData();

        try {
            double startTime = data.getRenderStartTime();
            double endTime = data.getRenderEndTime();

            /*
             * try { tempStart = Double.parseDouble(playStartText.getText()); }
             * catch(NumberFormatException nfe) { tempStart = 0.0f;
             * playStartText.setText(Double.toString(tempStart));
             * JOptionPane.showMessageDialog(null, BlueSystem
             * .getString("message.generateScore.startingFromZero")); }
             */

            boolean isApi = CommandlineRealtimeRenderServiceFactory.class != 
                    RealtimeRenderSettings.getInstance().renderServiceFactory.getClass();
                    

            CsdRenderResult result = CSDRenderService.getDefault().generateCSD(
                    data, startTime,
                    endTime,
                    true, isApi);

            String csd = result.getCsdText();

            InfoDialog.showInformationDialog(
                    WindowManager.getDefault().getMainWindow(), csd,
                    BlueSystem.getString("message.generateScore.csdTest"),
                    "text/x-csound-orc");
        } catch (Exception ex) {
            ExceptionDialog.showExceptionDialog(
                    WindowManager.getDefault().getMainWindow(),
                    ex);
            throw new RuntimeException("CSDRender Failed");
        }
    }
}
