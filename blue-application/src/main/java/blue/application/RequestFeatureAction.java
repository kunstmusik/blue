/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.application;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.net.URL;
import org.openide.awt.HtmlBrowser.URLDisplayer;
import org.openide.util.Exceptions;

public final class RequestFeatureAction implements ActionListener {

    static final String URL_RFE = "http://www.github.com/kunstmusik/blue/issues";

    @Override
    public void actionPerformed(ActionEvent e) {
        try {
            URLDisplayer.getDefault().showURL(new URL(URL_RFE));
        } catch (Exception ex) {
            Exceptions.printStackTrace(ex);
        }
    }
}
