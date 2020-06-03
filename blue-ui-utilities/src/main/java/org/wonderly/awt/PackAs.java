package org.wonderly.awt;

import java.awt.Component;
import java.awt.Container;
import java.awt.Insets;

/**
 * This interface is returned/used by the Packer layout manager. The methods are
 * used to arrange the layout of components.
 * 
 * The majority of these methods correspond directly to elements of the
 * GridBagConstraints object and its use with the GridBagLayout layout manager.
 * The purpose of this class is to make the use of these two objects simpler and
 * less error prone by allowing the complete layout of an object to be specified
 * in a single line of code, and to discourage the reuse of GridBagConstraint
 * Objects which leads to subtle layout interactions.
 * <p>
 * Pay attention to the fact that fillx(), filly() and fillboth() change the
 * weights of the respective axis. This is done to unify the expansion factors
 * to equally distribute the components if you do not specify weight[xy] values.
 * If you do not specify the weight[xy] values, they default to 1. Thus, you
 * must always put the weight[xy]() after the fill[xy]() if you want something
 * different than equal expansion.
 * <p>
 * When putting several buttons into a JPanel, you can use
 * <code>...fillx().weightx(0)</code> to make all of them the same width, but
 * keep the JPanel from being any wider than the widest button.
 * 
 * @version 3.0
 * @author <a href=mailto:gregg.wonderly@pobox.com>Gregg Wonderly</a>
 * @see org.wonderly.awt.Packer
 */

public interface PackAs extends java.io.Serializable {
    /**
     * Set the passed container as the container to pack future components into.
     * 
     * @exception IllegalAccessException
     *                when the container is already set and cloning the Packer
     *                instance fails.
     */
    public PackAs into(Container cont) throws IllegalAccessException;

    /**
     * Specifies the insets to apply to the component.
     * 
     * @param insets
     *            the insets to apply
     */
    public PackAs inset(Insets insets);

    /**
     * Specifies the insets to apply to the component.
     * 
     * @param left
     *            the left side inset.
     * @param top
     *            the top inset.
     * @param right
     *            the right side inset.
     * @param bottom
     *            the bottom inset.
     */
    public PackAs inset(int top, int left, int bottom, int right);

    /**
     * Add anchor=NORTH to the constraints for the current component.
     */
    public PackAs north();

    /**
     * Add anchor=SOUTH to the constraints for the current component.
     */
    public PackAs south();

    /**
     * Add anchor=EAST to the constraints for the current component.
     */
    public PackAs east();

    /**
     * Add anchor=WEST to the constraints for the current component.
     */
    public PackAs west();

    /**
     * Add anchor=NORTHWEST to the constraints for the current component.
     */
    public PackAs northwest();

    /**
     * Add anchor=SOUTHWEST to the constraints for the current component.
     */
    public PackAs southwest();

    /**
     * Add anchor=NORTHEAST to the constraints for the current component.
     */
    public PackAs northeast();

    /**
     * Add anchor=SOUTHEAST to the constraints for the current component.
     */
    public PackAs southeast();

    /**
     * Add gridx=RELATIVE to the constraints for the current component.
     */
    public PackAs left();

    /**
     * Add gridy=RELATIVE to the constraints for the current component.
     */
    public PackAs top();

    /**
     * Add gridx=REMAINDER to the constraints for the current component.
     */
    public PackAs right();

    /**
     * Add gridy=REMAINDER to the constraints for the current component.
     */
    public PackAs bottom();

    /**
     * Add gridx=tot to the constraints for the current component.
     * 
     * @param pos -
     *            the value to set gridx to.
     */
    public PackAs gridx(int pos);

    /**
     * Add gridy=tot to the constraints for the current component.
     * 
     * @param pos -
     *            the value to set gridy to.
     */
    public PackAs gridy(int pos);

    /**
     * Add gridheight=tot to the constraints for the current component.
     * 
     * @param cnt -
     *            the value to set gridheight to.
     */
    public PackAs gridh(int cnt);

    /**
     * Add gridwidth=tot to the constraints for the current component.
     * 
     * @param cnt -
     *            the value to set gridwidth to.
     */
    public PackAs gridw(int cnt);

    /**
     * Add ipadx=cnt to the constraints for the current component.
     * 
     * @param cnt -
     *            the value to set ipadx to.
     */
    public PackAs padx(int cnt);

    /**
     * Add ipady=cnt to the constraints for the current component.
     * 
     * @param cnt -
     *            the value to set ipady to.
     */
    public PackAs pady(int cnt);

    /**
     * Add fill=HORIZONTAL,weightx=1 to the constraints for the current
     * component.
     */
    public PackAs fillx();

    /**
     * Add fill=VERTICAL,weighty=1 to the constraints for the current component.
     */
    public PackAs filly();

    /**
     * Add fill=BOTH,weighty=1,weightx=1 to the constraints for the current
     * component.
     */
    public PackAs fillboth();

    /**
     * Add weightx=wt to the constraints for the current component.
     * 
     * @param wt -
     *            the value to set weightx to.
     */
    public PackAs weightx(double wt);

    /**
     * Add weighty=wt to the constraints for the current component.
     * 
     * @param wt -
     *            the value to set weightx to.
     */
    public PackAs weighty(double wt);

    /**
     * Reuses the previous set of constraints to layout the passed Component.
     * 
     * @param c
     *            The component to layout.
     */
    public PackAs add(Component c);

    /**
     * Creates a new set of constraints to layout the passed Component.
     * 
     * @param c
     *            The component to layout.
     */
    public PackAs pack(Component c);

    /**
     * Add gridwidth=REMAINDER to the constraints for the current component.
     */
    public PackAs remainx();

    /**
     * Add gridheight=REMAINDER to the constraints for the current component.
     */
    public PackAs remainy();
}