/*
 * blue - object composition environment for csound
 * Copyright (C) 2015
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
package blue.jfx.binding;

import blue.jfx.BlueFX;
import java.lang.ref.WeakReference;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.beans.property.ObjectProperty;
import javafx.beans.value.ChangeListener;
import javafx.scene.control.ChoiceBox;

/**
 *
 * @author stevenyi
 */
public class ChoiceBinder<T> {

    AtomicBoolean committing = new AtomicBoolean(false);
    private final WeakReference<ChoiceBox<T>> choiceBox;
    private WeakReference<ObjectProperty<T>> objProperty = null;
    ChangeListener<T> cl;
    private WeakReference<T> bean = null;

    public ChoiceBinder(ChoiceBox<T> cb) {
        this.choiceBox = new WeakReference<>(cb);

        cb.valueProperty().addListener((obs, o, n) -> {
            BlueFX.runOnFXThread(() -> {
                ObjectProperty<T> prop = (objProperty == null) ? null : objProperty.get();
                if (prop != null) {
                    prop.setValue(n);
                }
            });
        });

        cl = (obs, oldVal, newVal) -> {
            ChoiceBox choice = choiceBox.get();
            if (choice != null) {
                BlueFX.runOnFXThread(()
                        -> choice.setValue(newVal)
                );
            }
        };
    }
    
    public void setObjectProperty(ObjectProperty<T> prop) {
        ChoiceBox cb;
        ObjectProperty<T> op = objProperty == null ? null : objProperty.get();

        if ((cb = choiceBox.get()) == null) {
            return;
        }

        if (op != null) {
            op.removeListener(cl);
        }

        this.objProperty = null;
        BlueFX.runOnFXThread(
                () -> cb.setValue(prop.getValue())
        );

        this.objProperty = new WeakReference<>(prop);
        prop.addListener(cl);
    }

}
