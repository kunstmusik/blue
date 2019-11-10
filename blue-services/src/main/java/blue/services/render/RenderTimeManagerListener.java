/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.services.render;

/**
 *
 * @author stevenyi
 */
public interface RenderTimeManagerListener {
    void renderInitiated();
    void renderEnded();
    void renderTimeUpdated(double timePointer);
}
