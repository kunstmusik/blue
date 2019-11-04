/*
 * BSBObjectListener.java
 *
 * Created on August 4, 2005, 1:15 PM
 *
 * Interface for editors that need to listen for changes to the BSBObject they
 * are editing.
 */

package blue.orchestra.blueSynthBuilder;

/**
 * Interface to implement if an object wishes to listen for BSBObject changes
 * 
 * @author mbechard
 */
public interface BSBObjectListener {
    public void bsbObjectChanged(BSBObject object);
}
