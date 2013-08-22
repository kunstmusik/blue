/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.application;

import java.awt.Desktop;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.net.URI;
import java.net.URL;
import org.openide.awt.HtmlBrowser.URLDisplayer;
import org.openide.util.Exceptions;

public final class RequestFeatureAction implements ActionListener {

    static final String URL_RFE = "http://sourceforge.net/tracker/?group_id=74382&atid=540833";

    @Override
    public void actionPerformed(ActionEvent e) {
        try {
            if (Desktop.isDesktopSupported()) {
                Desktop.getDesktop().browse(new URI(URL_RFE));
            } else {
                URLDisplayer.getDefault().showURL(new URL(URL_RFE));
            }
        } catch (Exception ex) {
            Exceptions.printStackTrace(ex);
        }
    }
}
