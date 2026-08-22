"""create_return_requests_table

Revision ID: a28f389e8e18
Revises: '87b71e9ec9e5'
Create Date: 2026-08-22 13:44:13.882191

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a28f389e8e18'
down_revision: Union[str, None] = '87b71e9ec9e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'return_requests',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('order_id', sa.UUID(), nullable=False),
        sa.Column('order_item_id', sa.UUID(), nullable=False),
        sa.Column('type', sa.Enum('RETURN', 'EXCHANGE', name='return_type', native_enum=False), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('status', sa.Enum('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED', name='return_status', native_enum=False), nullable=False),
        sa.Column('requested_qty', sa.Integer(), nullable=False),
        sa.Column('exchange_for_product_id', sa.UUID(), nullable=True),
        sa.Column('resolved_by', sa.UUID(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolution_note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['exchange_for_product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['order_item_id'], ['order_items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['resolved_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_return_requests_order_id'), 'return_requests', ['order_id'], unique=False)
    op.create_index(op.f('ix_return_requests_order_item_id'), 'return_requests', ['order_item_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_return_requests_order_item_id'), table_name='return_requests')
    op.drop_index(op.f('ix_return_requests_order_id'), table_name='return_requests')
    op.drop_table('return_requests')
