/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.application;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.net.URL;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
import org.openide.awt.ActionRegistration;
import org.openide.awt.HtmlBrowser.URLDisplayer;
import org.openide.util.Exceptions;
import org.openide.util.NbBundle.Messages;

@ActionID(category = "Application",
        id = "blue.application.BlueChatAction")
@ActionRegistration(displayName = "#CTL_BlueChatAction")
@ActionReferences({
    @ActionReference(path = "Menu/Help", position = 1600, separatorBefore = 1550)
})
@Messages("CTL_BlueChatAction=Blue/Csound Chat")
public final class BlueChatAction implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {

        String url = "https://discord.gg/tw7XGWRKZ3";

        try {
            URLDisplayer.getDefault().showURL(new URL(url));
        } catch (Exception ex) {
            Exceptions.printStackTrace(ex);
        }
    }
}
