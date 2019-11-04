/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.orchestra.blueSynthBuilder;

import java.text.MessageFormat;
import java.util.concurrent.atomic.AtomicInteger;

/**
 *
 * @author stevenyi
 */
public class StringChannelNameManager {

    private static MessageFormat STRING_VAR_NAME = new MessageFormat(
            "gS_blue_str{0}");
    
    private AtomicInteger stringChannelCounter = new AtomicInteger(0);

    public String getUniqueStringChannel() {
        Object vars = new Object[]{stringChannelCounter.getAndIncrement()};
        String varName = STRING_VAR_NAME.format(vars);
        return varName;
    }
}
