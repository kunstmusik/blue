/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.automation;

import java.text.MessageFormat;
import java.util.concurrent.atomic.AtomicInteger;

/**
 *
 * @author stevenyi
 */
public class ParameterNameManager {

    private static final MessageFormat PARAM_VAR_NAME = new MessageFormat(
            "gk_blue_auto{0}");
    
    private AtomicInteger paramNameCounter;

    public ParameterNameManager(){
        this(0);
    }

    protected ParameterNameManager(int start) {
        paramNameCounter = new AtomicInteger(start);
    }

    public String getUniqueParamName() {
        Object vars = new Object[]{
            Integer.toString(paramNameCounter.getAndIncrement())
        };
        String varName = PARAM_VAR_NAME.format(vars);
        return varName;
    }
}
